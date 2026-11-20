// v112 security release: H1 attachment MIME, M1 cross-workspace IDOR,
// M2 webhook SSRF guard, M3 /pay/test live gate, M5 pinned auth-link base,
// M6 security headers, L3 certificate scoping, L5 password-change revocation.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v112-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.env.PORT = String(20000 + Math.floor(Math.random() * 20000));
delete process.env.BASE_URL;
delete process.env.STRIPE_SECRET_KEY;
delete process.env.ALLOW_PRIVATE_WEBHOOK_URLS;
process.chdir(tmp);

const PW = ["v112", "pw", "4471"].join("-");
let B = ""; let dbm: any;
const jar = () => ({ cookie: "" });
async function call(c: any, method: string, p: string, body?: any) {
  const r = await fetch(B + p, { method, headers: { "content-type": "application/json", ...(c.cookie ? { cookie: c.cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.get("set-cookie"); if (sc) c.cookie = sc.split(";")[0];
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch {}
  return { status: r.status, j, headers: r.headers, text: t };
}
let A: any, Buser: any, wsA = "", leadA = "";

before(async () => {
  dbm = await import("../server/db.ts"); dbm.initSchema();
  await import("../server/index.ts");
  const appMod: any = await import("../server/app.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { B = `http://127.0.0.1:${(s.address() as any).port}`; res(); }); });
  A = jar(); Buser = jar();
  const ra = await call(A, "POST", "/api/auth/register", { name: "Ann A", email: "a@v112.co", password: PW, business_name: "A Co" });
  assert.equal(ra.status, 201, JSON.stringify(ra.j));
  const rb = await call(Buser, "POST", "/api/auth/register", { name: "Bob B", email: "b@v112.co", password: PW, business_name: "B Co" });
  assert.equal(rb.status, 201, JSON.stringify(rb.j));
  const me = await call(A, "GET", "/api/auth/me"); wsA = me.j.user.workspace_id;
  dbm.db.prepare("INSERT INTO leads (id, workspace_id, state, service_requested) VALUES (?,?,?,?)").run("lead_v112", wsA, "NEW", "Asbestos survey");
  leadA = "lead_v112";
});

test("M6: security headers on every response, no x-powered-by", async () => {
  const r = await call(jar(), "GET", "/api/auth/me");
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.equal(r.headers.get("x-frame-options"), "DENY");
  assert.ok((r.headers.get("content-security-policy") || "").includes("frame-ancestors 'none'"));
  assert.equal(r.headers.get("x-powered-by"), null);
});

test("H1: uploaded HTML is coerced to octet-stream and never served inline", async () => {
  const html = Buffer.from("<script>alert(1)</script>").toString("base64");
  const up = await call(A, "POST", "/api/attachments", { entity_type: "lead", entity_id: leadA, name: "evil.html", mime: "text/html", data_base64: html });
  assert.equal(up.status, 201, JSON.stringify(up.j));
  assert.equal(up.j.mime, "application/octet-stream");
  const dl = await fetch(`${B}/api/attachments/${up.j.id}/download?inline=1`, { headers: { cookie: A.cookie } });
  assert.ok((dl.headers.get("content-disposition") || "").startsWith("attachment"));
  assert.equal(dl.headers.get("x-content-type-options"), "nosniff");
  assert.equal(dl.headers.get("content-security-policy"), "sandbox");
  const png = await call(A, "POST", "/api/attachments", { entity_type: "lead", entity_id: leadA, name: "photo.png", mime: "image/png", data_base64: Buffer.from([0x89, 0x50]).toString("base64") });
  assert.equal(png.j.mime, "image/png");
  const dl2 = await fetch(`${B}/api/attachments/${png.j.id}/download?inline=1`, { headers: { cookie: A.cookie } });
  assert.ok((dl2.headers.get("content-disposition") || "").startsWith("inline"));
});

test("M1: cross-workspace contact + packet-check are 404", async () => {
  const x = await call(Buser, "POST", `/api/leads/${leadA}/contact`, { type: "call", body: "intrusion" });
  assert.equal(x.status, 404);
  const y = await call(Buser, "POST", `/api/leads/${leadA}/packet-check`, {});
  assert.equal(y.status, 404);
  const own = await call(A, "POST", `/api/leads/${leadA}/contact`, { type: "call", body: " legit" });
  assert.equal(own.status, 200);
});

test("M2: webhook create rejects private + loopback destinations", async () => {
  const bad1 = await call(A, "POST", "/api/webhooks", { url: "http://169.254.169.254/latest/meta-data" });
  assert.equal(bad1.status, 400); assert.equal(bad1.j.error.code, "url_not_public");
  const bad2 = await call(A, "POST", "/api/webhooks", { url: "http://localhost:8080/hook" });
  assert.equal(bad2.status, 400); assert.equal(bad2.j.error.code, "url_not_public");
});

test("M3: /pay/test retires when a live Stripe key exists or the payment is a Connect charge", async () => {
  dbm.db.prepare("INSERT INTO payments (id, workspace_id, kind, amount, status, mode) VALUES (?,?,?,?,?,?)").run("pay_v112", wsA, "deposit", 50, "pending", "test");
  const ok = await fetch(`${B}/pay/test/pay_v112`);
  assert.equal(ok.status, 200);
  dbm.db.prepare("INSERT INTO payments (id, workspace_id, kind, amount, status, mode, stripe_account_id) VALUES (?,?,?,?,?,?,?)").run("pay_v112b", wsA, "deposit", 50, "pending", "test", "acct_live");
  const conn = await fetch(`${B}/pay/test/pay_v112b`);
  assert.equal(conn.status, 404);
  process.env.STRIPE_SECRET_KEY = ["sk", "live", "v112"].join("_");
  try {
    const gated = await fetch(`${B}/pay/test/pay_v112`);
    assert.equal(gated.status, 404);
    const gatedPost = await fetch(`${B}/pay/test/pay_v112`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "" });
    assert.equal(gatedPost.status, 404);
    const row = dbm.db.prepare("SELECT status FROM payments WHERE id=?").get("pay_v112") as any;
    assert.equal(row.status, "pending");
  } finally { delete process.env.STRIPE_SECRET_KEY; }
});

test("L3: signature certificate is workspace-scoped", async () => {
  dbm.db.prepare("INSERT INTO proposals (id, workspace_id, lead_id, status, total) VALUES (?,?,?,?,?)").run("prop_v112", wsA, leadA, "signed", 100);
  dbm.db.prepare("INSERT INTO signatures (id, proposal_id, workspace_id, signer_name, signed_at, doc_hash, ip) VALUES (?,?,?,?,?,?,?)").run("sig_v112", "prop_v112", wsA, "Jane Signer", new Date().toISOString(), "hash1", "1.2.3.4");
  const x = await call(Buser, "GET", "/api/proposals/prop_v112/certificate");
  assert.equal(x.status, 404);
  const own = await call(A, "GET", "/api/proposals/prop_v112/certificate");
  assert.equal(own.status, 200); assert.equal(own.j.signer, "Jane Signer");
});

test("L5: password change revokes other sessions, keeps the current one", async () => {
  const c1 = jar(), c2 = jar();
  await call(c1, "POST", "/api/auth/register", { name: "Cat C", email: "c@v112.co", password: PW, business_name: "C Co" });
  const l2 = await call(c2, "POST", "/api/auth/login", { email: "c@v112.co", password: PW });
  assert.equal(l2.status, 200, JSON.stringify(l2.j));
  const ch = await call(c1, "POST", "/api/users/me/password", { current: PW, next: PW + "-new" });
  assert.equal(ch.status, 200, JSON.stringify(ch.j));
  const other = await call(c2, "GET", "/api/auth/me");
  assert.equal(other.status, 401);
  const mine = await call(c1, "GET", "/api/auth/me");
  assert.equal(mine.status, 200);
});

test("M5: reset links are pinned to the canonical base, never the request Host", async () => {
  const f = await call(jar(), "POST", "/api/auth/forgot", { email: "c@v112.co" });
  assert.equal(f.status, 200);
  assert.equal(f.j.test_mode, true);
  assert.ok(f.j.reset_url.startsWith("https://workpile.claimpaid.io/app?reset="), f.j.reset_url);
});

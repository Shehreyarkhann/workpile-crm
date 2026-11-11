// End-to-end smoke: boot server on a temp DB, run the full journey:
// login → API lead create (idempotent) → qualify → proposal → approval gate → approve → send → won → outcome pull + ack
import { spawn } from "node:child_process";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-smoke-"));
const DB = path.join(tmp, "s.db");
const PORT = 4199;
const base = `http://localhost:${PORT}`;
const run = (cmd, args, env = {}) => new Promise((res, rej) => { const p = spawn(cmd, args, { cwd: process.cwd(), env: { ...process.env, LEADFLOW_DB: DB, ...env }, stdio: "pipe" }); let out = ""; p.stdout.on("data", d => out += d); p.stderr.on("data", d => out += d); p.on("close", c => c === 0 ? res(out) : rej(new Error(out))); });
let server;
try {
  await run("node", ["server/seed.ts"]);
  server = spawn("node", ["server/index.ts"], { cwd: process.cwd(), env: { ...process.env, LEADFLOW_DB: DB, PORT: String(PORT) }, stdio: "pipe" });
  // find demo api key from seed output is not available here; re-derive: seed prints it when run above but run() captured — instead query via login flow for app flows, and use a fresh key check through DB is skipped; API key flow tested via direct DB insert:
  const { DatabaseSync } = await import("node:sqlite");
  const { createHash } = await import("node:crypto");
  const db = new DatabaseSync(DB);
  const ws = db.prepare("SELECT id FROM workspaces LIMIT 1").get().id;
  const KEY = "lf_smoke_key_123";
  db.prepare("INSERT INTO api_keys (id,workspace_id,label,hashed_key,scopes) VALUES (?,?,?,?,?)").run("key_smoke", ws, "smoke", createHash("sha256").update(KEY).digest("hex"), "leads:write,outcomes:read,projects:read");
  const users = db.prepare("SELECT id,email,role FROM users").all();
  const pmId = users.find(u => u.role === "PM").id;
  for (let i = 0; i < 40; i++) { try { const r = await fetch(base + "/api/health"); if (r.ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); }
  const J = async (p, o = {}) => { const r = await fetch(base + p, { method: o.method || "GET", headers: { "Content-Type": "application/json", ...(o.headers || {}) }, body: o.body ? JSON.stringify(o.body) : undefined }); const j = await r.json().catch(() => ({})); return { status: r.status, j, cookie: r.headers.get("set-cookie") }; };
  const login = await J("/api/auth/login", { method: "POST", body: { email: "owner@demo.test", password: "demo1234" } });
  if (login.status !== 200) throw new Error("login failed " + JSON.stringify(login.j));
  const cookie = login.cookie.split(";")[0];
  const H = { Cookie: cookie };
  const pmLogin = await J("/api/auth/login", { method: "POST", body: { email: "paul@demo.test", password: "demo1234" } });
  if (pmLogin.status !== 200) throw new Error("pm login failed");
  const HP = { Cookie: pmLogin.cookie.split(";")[0] };
  // API ingestion with idempotency
  const payload = { contact: { name: "Smoke Test", phone: "+15165559999", email: "smoke@example.com" }, service_requested: "Water damage cleanup", est_value: 6000, message: "Flooded basement, this week", location: "Bay Shore, NY", source: "website-form" };
  const c1 = await J("/v1/leads", { method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Idempotency-Key": "smoke-1" }, body: payload });
  const c2 = await J("/v1/leads", { method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Idempotency-Key": "smoke-1" }, body: payload });
  if (c1.status !== 201 || c1.j.id !== c2.j.id) throw new Error("idempotent create failed " + JSON.stringify([c1, c2]));
  const leadId = c1.j.id;
  const dupe = await J("/v1/leads", { method: "POST", headers: { Authorization: `Bearer ${KEY}` }, body: payload });
  if (!dupe.j.duplicate) throw new Error("dedupe failed");
  // walk the workflow
  const T = async (to, extra = {}, headers = H) => { const r = await J(`/api/leads/${leadId}/transition`, { method: "POST", headers, body: { to_state: to, ...extra } }); if (r.status !== 200) throw new Error(`transition →${to} failed: ` + JSON.stringify(r.j)); };
  // assign PM first (gate requires it)
  const detail = await J(`/api/leads/${leadId}`, { headers: H });
  await T("TRIAGED"); await T("QUALIFYING"); await T("QUALIFIED", { pm_id: pmId });
  // v3: no gate wall — readiness is a checklist. Moving on works; the checklist reports what's missing.
  const chk = await J(`/api/leads/${leadId}/packet-check`, { method: "POST", headers: H, body: {} });
  if (chk.j.complete) throw new Error("readiness should report incomplete without a proposal");
  await J("/api/settings", { method: "PATCH", headers: H, body: { approval_policy: "always" } }); // v3 approvals are policy-driven
  const pb = await J("/api/price-book", { headers: H });
  // proposal can only be created pre-approval in real flow via builder; create draft directly through API while QUALIFIED:
  const prop = await J(`/api/leads/${leadId}/proposals`, { method: "POST", headers: HP, body: { line_items: [{ price_book_item_id: pb.j[0].id, qty: 1 }, { price_book_item_id: pb.j[1].id, qty: 2 }] } });
  if (prop.status !== 201) throw new Error("proposal failed " + JSON.stringify(prop.j));
  await T("READY_FOR_APPROVAL", {}, HP); // submitted by the PM: owners bypass gates (v25), so the policy gate fires for Paul and routes to an approver
  const appr = await J("/api/approvals", { headers: H });
  if (!appr.j.length) throw new Error("approval inbox empty");
  const dec = await J(`/api/approvals/${appr.j[0].id}/decide`, { method: "POST", headers: H, body: { decision: "approved" } });
  if (dec.status !== 200) throw new Error("approve failed " + JSON.stringify(dec.j));
  let d = await J(`/api/leads/${leadId}`, { headers: H });
  if (d.j.lead.state !== "PROPOSAL") throw new Error("expected PROPOSAL (v3 stage), got " + d.j.lead.state);
  await T("PROPOSAL_DRAFTED"); await T("PROPOSAL_SENT"); await T("WON");
  // outcome pull + ack (§14.5)
  const outcomes = await J("/v1/outcomes", { headers: { Authorization: `Bearer ${KEY}` } });
  const mine = outcomes.j.find(o => o.lead.id === leadId);
  if (!mine || mine.outcome !== "won") throw new Error("won outcome missing from /v1/outcomes");
  const ack = await J(`/v1/outcomes/${mine.delivery_id}/ack`, { method: "POST", headers: { Authorization: `Bearer ${KEY}` }, body: { external_id: "EXT-PROJ-1", status: "ingested" } });
  if (ack.status !== 200) throw new Error("ack failed");
  const metrics = await J("/api/metrics", { headers: H });
  if (metrics.j.first_pass_approval_rate !== 100) throw new Error("FPAR should be 100, got " + metrics.j.first_pass_approval_rate);
  console.log("SMOKE PASS — journey: API create (idempotent+dedupe) → readiness checked → proposal → approval (FPAR 100%) → won → outcome delivered + acked");
} finally { if (server) server.kill(); }

// v71.1: personal Anthropic keys (sk-ant-usr-…) are identity-linked and only
// work when the request names the org workspace — Workpile stores an optional
// Anthropic workspace ID per workspace and sends it as the
// anthropic-workspace-id header. The provider test endpoint also returns the
// provider's real error message (HTTP 200 + ok:false) instead of a bare 502,
// so the Settings screen can show what Anthropic actually said.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

let base = ""; let dbm: any; let llm: any;
let cookie = "";
async function call(method: string, p: string, body?: any) {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* noop */ }
  return { status: r.status, body: j };
}
const PW = ["v711", "pw", "7111"].join("-");
let wsId = "";
const realFetch = globalThis.fetch;
let captured: any = null; let upstreamMode: "ok" | "err" = "ok";
function stubFetch() {
  (globalThis as any).fetch = async (url: any, init: any = {}) => {
    const u = String(url);
    if (u.startsWith("http://127.0.0.1")) return realFetch(url, init);
    captured = { url: u, headers: init.headers || {} };
    if (upstreamMode === "err") return { ok: false, status: 400, text: async () => JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "anthropic-workspace-id header is required for this key" } }), json: async () => ({}) };
    return { ok: true, status: 200, text: async () => "", json: async () => ({ content: [{ type: "text", text: "ready" }], usage: { input_tokens: 3, output_tokens: 1 }, model: "claude-sonnet-4-5" }) };
  };
}

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v711-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir); process.env.PORT = String(24000 + Math.floor(Math.random() * 8000));
  dbm = await import("../server/db.ts"); dbm.initSchema();
  await import("../server/index.ts");
  const appMod = await import("../server/app.ts");
  llm = await import("../server/llm.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await call("POST", "/api/auth/register", { name: "Olive Owner", email: "owner711@demo.test", password: PW, business_name: "V711 Environmental" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  await call("POST", "/api/auth/login", { email: "owner711@demo.test", password: PW });
  wsId = (await call("GET", "/api/auth/me")).body.user.workspace_id;
});

test("the saved workspace ID is sent as the anthropic-workspace-id header", async () => {
  stubFetch(); upstreamMode = "ok"; captured = null;
  const save = await call("PATCH", "/api/ai/provider", { provider: "anthropic", model: "claude-sonnet-4-5", api_key: ["sk-ant-usr", "test", "000"].join("-"), workspace_id: "wrkspc_test123" });
  assert.equal(save.status, 200, JSON.stringify(save.body));
  assert.equal(save.body.anthropic_workspace_id, "wrkspc_test123");
  const p = llm.getProvider(wsId); assert.ok(p, "provider configured");
  const r = await p.chat({ system: "s", messages: [{ role: "user", content: "ping" }], maxTokens: 8 });
  assert.equal(r.text, "ready");
  assert.equal(captured.headers["anthropic-workspace-id"], "wrkspc_test123");
  assert.ok(captured.headers["x-api-key"]);
});

test("without a workspace ID no header is sent (workspace keys need none)", async () => {
  stubFetch(); upstreamMode = "ok"; captured = null;
  const save = await call("PATCH", "/api/ai/provider", { workspace_id: "" });
  assert.equal(save.body.anthropic_workspace_id, null);
  const p = llm.getProvider(wsId); assert.ok(p);
  await p.chat({ system: "s", messages: [{ role: "user", content: "ping" }], maxTokens: 8 });
  assert.equal(captured.headers["anthropic-workspace-id"], undefined);
});

test("the test endpoint surfaces the provider's real error instead of a bare 502", async () => {
  stubFetch(); upstreamMode = "err";
  const r = await call("POST", "/api/ai/provider/test", {});
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.ok, false);
  assert.match(String(r.body.error), /anthropic 400/);
  assert.match(String(r.body.error), /workspace-id/);
});

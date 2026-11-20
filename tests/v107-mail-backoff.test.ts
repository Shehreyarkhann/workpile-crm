// v107 — a Gmail 403 stops being a mystery and stops being hammered:
// the provider's own reason lands in last_error, quota-shaped failures
// back off exponentially, the poller skips the connection until the
// backoff expires, and a healthy poll resets everything.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v107-"));
process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir);
process.env.GOOGLE_CLIENT_ID = "gid"; process.env.GOOGLE_CLIENT_SECRET = "gsecret";
const dbm = await import("../server/db.ts"); dbm.initSchema();
const mailsync = await import("../server/mail-sync.ts");

let connId = ""; let healthy = false; let gmailCalls = 0;
const ff = async (url: string, _init?: any) => {
  const u = String(url);
  const json = (status: number, obj: any) => ({ status, json: async () => obj });
  if (u.includes("oauth2.googleapis.com/token")) return json(200, { access_token: "tok-v107" });
  if (u.includes("gmail.googleapis.com")) {
    gmailCalls++;
    if (!healthy) return json(403, { error: { message: "Quota exceeded for quota metric 'Queries'", errors: [{ reason: "userRateLimitExceeded" }] } });
    if (u.includes("messages?maxResults")) return json(200, { messages: [{ id: "m1" }] });
    if (u.includes("messages/m1?format=full")) return json(200, { snippet: "hi", payload: { headers: [{ name: "From", value: "Jane <jane@x.test>" }, { name: "Subject", value: "Hello" }, { name: "Date", value: "Mon, 10 Nov 2026 10:00:00 -0500" }], mimeType: "text/plain", body: { data: Buffer.from("hello there").toString("base64url") } } });
  }
  return { status: 404, json: async () => ({}) };
};
const ingest = (_ws: string, _a: string, _emails: any[]) => ({});
const row = () => dbm.db.prepare("SELECT * FROM oauth_connections WHERE id=?").get(connId) as any;

before(async () => {
  const ws = dbm.uid("ws");
  dbm.db.prepare("INSERT INTO workspaces (id, name, created_at) VALUES (?,?,?)").run(ws, "V107 Env", dbm.now());
  connId = dbm.uid("oau");
  dbm.db.prepare("INSERT INTO oauth_connections (id,workspace_id,provider,account_email,status,token_ref,created_at) VALUES (?,?, 'google', 'q@x.test', 'connected', 'rtok', ?)").run(connId, ws, dbm.now());
});

test("403 carries its reason, backs off, skips, then recovers clean", async () => {
  const r1 = await mailsync.processMailSync(ingest as any, ff as any);
  assert.equal(r1.errors, 1);
  assert.match(row().last_error, /userRateLimitExceeded/, "the card can now say WHY");
  assert.equal(row().error_strikes, 1);
  assert.ok(new Date(row().backoff_until).getTime() > Date.now(), "backoff is in the future");
  const callsBefore = gmailCalls;
  const r2 = await mailsync.processMailSync(ingest as any, ff as any);
  assert.equal(r2.polled, 0, "backed-off connections are skipped, not retried into the wall");
  assert.equal(gmailCalls, callsBefore, "no Gmail calls during backoff");
  dbm.db.prepare("UPDATE oauth_connections SET backfill_done=1, last_poll_at=? WHERE id=?").run(dbm.now(), connId);
  dbm.db.prepare("UPDATE oauth_connections SET backoff_until=NULL WHERE id=?").run(connId);
  healthy = true;
  const r3 = await mailsync.processMailSync(ingest as any, ff as any);
  assert.equal(r3.ingested, 1, "sync resumes when Google lets it");
  assert.equal(row().error_strikes, 0); assert.equal(row().backoff_until, null); assert.equal(row().last_error, null);
});

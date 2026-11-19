// v105 — mail backfill: a 650-message Gmail history pages in completely
// over successive polls (300/poll budget, cursor persisted between
// polls, nothing duplicated, nothing skipped), then steady-state polls
// ingest nothing new.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v105-"));
process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir);
process.env.GOOGLE_CLIENT_ID = "gid"; process.env.GOOGLE_CLIENT_SECRET = "gsecret";
const dbm = await import("../server/db.ts"); dbm.initSchema();
const mailsync = await import("../server/mail-sync.ts");

const TOTAL = 650, PAGE = 100;
const allIds = Array.from({ length: TOTAL }, (_, i) => "m" + (i + 1));
const ingested: any[] = [];
const ingest = (_ws: string, _actor: string, emails: any[]) => { ingested.push(...emails); return {}; };

const ff = async (url: string, _init?: any) => {
  const u = String(url);
  const json = (obj: any) => ({ status: 200, json: async () => obj });
  if (u.includes("oauth2.googleapis.com/token")) return json({ access_token: "tok-v105" });
  if (u.includes("messages?maxResults")) {
    const m = u.match(/pageToken=(\d+)/);
    const page = m ? Number(m[1]) : 0;
    const slice = allIds.slice(page * PAGE, page * PAGE + PAGE);
    return json({ messages: slice.map(id => ({ id })), ...(page * PAGE + PAGE < TOTAL ? { nextPageToken: String(page + 1) } : {}) });
  }
  const one = u.match(/messages\/(m\d+)\?format=full/);
  if (one) return json({ snippet: "body of " + one[1], payload: { headers: [{ name: "From", value: "Sender <s@x.test>" }, { name: "Subject", value: "Msg " + one[1] }, { name: "Date", value: "Mon, 10 Nov 2026 10:00:00 -0500" }], mimeType: "text/plain", body: { data: Buffer.from("body of " + one[1]).toString("base64url") } } });
  return { status: 404, json: async () => ({}) };
};

let connId = "";
before(async () => {
  const ws = dbm.uid("ws");
  dbm.db.prepare("INSERT INTO workspaces (id, name, created_at) VALUES (?,?,?)").run(ws, "V105 Env", dbm.now());
  connId = dbm.uid("oau");
  dbm.db.prepare("INSERT INTO oauth_connections (id,workspace_id,provider,account_email,status,token_ref,created_at) VALUES (?,?, 'google', 'big@inbox.test', 'connected', 'rtok', ?)").run(connId, ws, dbm.now());
});

test("the whole history pages in over three polls — complete, deduped, cursor-resumed", async () => {
  const connRow = () => dbm.db.prepare("SELECT backfill_done, sync_token FROM oauth_connections WHERE id=?").get(connId) as any;
  const r1 = await mailsync.processMailSync(ingest as any, ff as any);
  assert.equal(r1.ingested, 300, "poll 1 stops at the budget");
  assert.equal(connRow().backfill_done, 0); assert.ok(connRow().sync_token, "cursor persisted for the next poll");
  const r2 = await mailsync.processMailSync(ingest as any, ff as any);
  assert.equal(r2.ingested, 300, "poll 2 resumes where poll 1 stopped");
  assert.equal(connRow().backfill_done, 0);
  const r3 = await mailsync.processMailSync(ingest as any, ff as any);
  assert.equal(r3.ingested, 50, "poll 3 drains the remainder");
  assert.equal(connRow().backfill_done, 1, "backfill marked complete");
  assert.equal(ingested.length, TOTAL);
  assert.equal(new Set(ingested.map(e => e.external_id)).size, TOTAL, "no duplicates across polls");
  const r4 = await mailsync.processMailSync(ingest as any, ff as any);
  assert.equal(r4.ingested, 0, "steady state: nothing new, nothing re-ingested");
});

// Workpile — Web Push (slice 11, Tier 1: approval alerts on the lock screen).
// Honest gating: without VAPID keys in env, push is simply off (status says so).
import * as webpush from "web-push";
import { db, uid, now } from "./db.ts";

let configured = false;
export function pushConfigured(): boolean {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false;
  if (!configured) { webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:hello@workpile.io", process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY); configured = true; }
  return true;
}
export function vapidPublicKey(): string | null { return process.env.VAPID_PUBLIC_KEY || null; }
export function saveSubscription(userId: string, sub: any) {
  db.prepare("INSERT INTO push_subscriptions (id,user_id,endpoint,subscription,created_at) VALUES (?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id, subscription=excluded.subscription")
    .run(uid("push"), userId, sub.endpoint, JSON.stringify(sub), now());
}
export async function sendPush(userIds: string[], title: string, body: string, url = "/app") {
  if (!pushConfigured() || !userIds.length) return { sent: 0 };
  const rows = db.prepare(`SELECT * FROM push_subscriptions WHERE user_id IN (${userIds.map(() => "?").join(",")})`).all(...userIds) as any[];
  let sent = 0;
  for (const r of rows) {
    try { await webpush.sendNotification(JSON.parse(r.subscription), JSON.stringify({ title, body, url })); sent++; }
    catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) db.prepare("DELETE FROM push_subscriptions WHERE id=?").run(r.id); }
  }
  return { sent };
}

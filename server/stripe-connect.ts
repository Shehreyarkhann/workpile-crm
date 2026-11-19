// v103 — Stripe Connect, per workspace. Each workspace onboards its OWN
// Stripe Express account; client payments are direct charges on that
// account, so money lands with the business, never with Workpile. The
// platform key (STRIPE_SECRET_KEY) only brokers accounts, links and
// checkout sessions. No key → the feature reports itself unconfigured.
import { db, now } from "./db.ts";

type FetchFn = typeof fetch;
const realFetch: FetchFn = (input: any, init?: any) => fetch(input, init);

export function stripePlatformConfigured(): boolean { return !!process.env.STRIPE_SECRET_KEY; }

export function getStripeConnection(workspaceId: string): any {
  return db.prepare("SELECT workspace_id, account_id, charges_enabled, details_submitted, payouts_enabled, status, created_at, updated_at FROM stripe_connections WHERE workspace_id=?").get(workspaceId) as any || null;
}

export function connectAccountFor(workspaceId: string): string | null {
  const c = db.prepare("SELECT account_id FROM stripe_connections WHERE workspace_id=? AND charges_enabled=1").get(workspaceId) as any;
  return c?.account_id || null;
}

async function stripeCall(method: string, path: string, params?: Record<string, string>, fetchFn: FetchFn = realFetch): Promise<any> {
  const init: any = { method, headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" } };
  if (params && method !== "GET") init.body = new URLSearchParams(params);
  const r = await fetchFn(`https://api.stripe.com${path}`, init);
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Stripe: " + (j.error?.message || r.status));
  return j;
}

export async function ensureConnectAccount(workspaceId: string, fetchFn: FetchFn = realFetch): Promise<any> {
  const existing = db.prepare("SELECT * FROM stripe_connections WHERE workspace_id=?").get(workspaceId) as any;
  if (existing?.account_id) return existing;
  const ws = db.prepare("SELECT name FROM workspaces WHERE id=?").get(workspaceId) as any;
  const acct = await stripeCall("POST", "/v1/accounts", { type: "express", "capabilities[card_payments][requested]": "true", "capabilities[transfers][requested]": "true", "business_profile[name]": String(ws?.name || "Workpile business").slice(0, 100) }, fetchFn);
  db.prepare("INSERT INTO stripe_connections (workspace_id, account_id, charges_enabled, details_submitted, payouts_enabled, status, created_at, updated_at) VALUES (?,?,0,0,0,'onboarding',?,?) ON CONFLICT(workspace_id) DO UPDATE SET account_id=excluded.account_id, updated_at=excluded.updated_at")
    .run(workspaceId, acct.id, now(), now());
  return db.prepare("SELECT * FROM stripe_connections WHERE workspace_id=?").get(workspaceId);
}

export async function connectOnboardingUrl(workspaceId: string, baseUrl: string, fetchFn: FetchFn = realFetch): Promise<string> {
  const conn = await ensureConnectAccount(workspaceId, fetchFn);
  const link = await stripeCall("POST", "/v1/account_links", { account: conn.account_id, refresh_url: `${baseUrl}/api/stripe/connect/refresh`, return_url: `${baseUrl}/api/stripe/connect/return`, type: "account_onboarding" }, fetchFn);
  return link.url;
}

export async function refreshConnectStatus(workspaceId: string, fetchFn: FetchFn = realFetch): Promise<any> {
  const conn = db.prepare("SELECT * FROM stripe_connections WHERE workspace_id=?").get(workspaceId) as any;
  if (!conn?.account_id) return null;
  const acct = await stripeCall("GET", `/v1/accounts/${conn.account_id}`, undefined, fetchFn);
  const charges = acct.charges_enabled ? 1 : 0;
  db.prepare("UPDATE stripe_connections SET charges_enabled=?, details_submitted=?, payouts_enabled=?, status=?, updated_at=? WHERE workspace_id=?")
    .run(charges, acct.details_submitted ? 1 : 0, acct.payouts_enabled ? 1 : 0, charges ? "connected" : "onboarding", now(), workspaceId);
  return getStripeConnection(workspaceId);
}

export async function refreshConnectStatusByAccount(accountId: string, fetchFn: FetchFn = realFetch): Promise<void> {
  const conn = db.prepare("SELECT workspace_id FROM stripe_connections WHERE account_id=?").get(accountId) as any;
  if (conn) await refreshConnectStatus(conn.workspace_id, fetchFn);
}

export async function connectDashboardUrl(workspaceId: string, fetchFn: FetchFn = realFetch): Promise<string> {
  const conn = db.prepare("SELECT * FROM stripe_connections WHERE workspace_id=?").get(workspaceId) as any;
  if (!conn?.account_id) throw new Error("No Stripe account connected yet.");
  const link = await stripeCall("POST", `/v1/accounts/${conn.account_id}/login_links`, {}, fetchFn);
  return link.url;
}

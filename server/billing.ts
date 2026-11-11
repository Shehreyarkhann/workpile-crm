// Workpile — own subscription billing (§18 pricing, §26 C4 billing completeness)
// Plans mirror spec §18. Trial: 30 days, app-side, no card (proven ClaimPaid pattern).
// Stripe Checkout when STRIPE_SECRET_KEY + price IDs are set; otherwise checkout is
// honestly reported as not configured — never a fake payment flow for real money.
import { db, uid, now } from "./db.ts";

// PRICING V2 (founder decision 2026-11-11, replacing the 2026-11-10 per-seat
// model): charge per WORKSPACE, meter ACTIVE REQUESTS (leads not in a final
// state). Office users are included per tier; field/roster crew are not logins
// and are never counted or charged. The never-block rule: hitting the request
// allowance NEVER refuses intake — it drives upgrade prompts only. The only
// hard cap is office-user logins.
export type PlanFeatures = { sms: boolean; api: boolean; sending_domain: boolean; audit_export: boolean };
export type PlanDef = { name: string; users: number; active_requests: number; list_price: number; annual_price: number; ai_actions: number; features: PlanFeatures; price_env: string; price_env_monthly: string; legacy_env?: string; legacy_env_monthly?: string; custom?: boolean; blurb: string };
export const savePct = (p: PlanDef) => p.list_price > 0 ? Math.round((1 - p.annual_price / p.list_price) * 100) : 0;
export const PLANS: Record<string, PlanDef> = {
  starter: { name: "Starter", users: 2, active_requests: 150, list_price: 49, annual_price: 39, ai_actions: 1000, features: { sms: false, api: false, sending_domain: false, audit_export: false }, price_env: "STRIPE_PRICE_STARTER", price_env_monthly: "STRIPE_PRICE_STARTER_MONTHLY", legacy_env: "STRIPE_PRICE_SOLO", legacy_env_monthly: "STRIPE_PRICE_SOLO_MONTHLY", blurb: "For the small office getting its pile under control — price book, proposals, e-sign, email follow-ups." },
  pro: { name: "Pro", users: 5, active_requests: 750, list_price: 149, annual_price: 119, ai_actions: 5000, features: { sms: true, api: true, sending_domain: true, audit_export: false }, price_env: "STRIPE_PRICE_PRO", price_env_monthly: "STRIPE_PRICE_PRO_MONTHLY", legacy_env: "STRIPE_PRICE_TEAM", legacy_env_monthly: "STRIPE_PRICE_TEAM_MONTHLY", blurb: "The full execution system: SMS follow-ups, API + webhooks, your own sending domain." },
  business: { name: "Business", users: 15, active_requests: 3000, list_price: 349, annual_price: 299, ai_actions: 15000, features: { sms: true, api: true, sending_domain: true, audit_export: true }, price_env: "STRIPE_PRICE_BUSINESS", price_env_monthly: "STRIPE_PRICE_BUSINESS_MONTHLY", legacy_env: "STRIPE_PRICE_CREW", legacy_env_monthly: "STRIPE_PRICE_CREW_MONTHLY", blurb: "For multi-crew operations: audit-log export, advanced permissions, priority support and onboarding." },
  enterprise: { name: "Enterprise", users: 0, active_requests: 1000000, list_price: 0, annual_price: 0, ai_actions: 1000000, features: { sms: true, api: true, sending_domain: true, audit_export: true }, price_env: "", price_env_monthly: "", custom: true, blurb: "SSO/SAML, DPA, SLA, multiple locations and custom integrations — priced to your operation." },
};
// Legacy keys keep resolving (existing subscriptions are grandfathered on their
// Stripe price; resolution only drives features + caps). crew (the old top
// tier) resolves to Pro — an upgrade in included users (3 → 5).
export const PLAN_ALIASES: Record<string, string> = { solo: "starter", team: "pro", crew: "pro", growth: "pro" };
export function planOf(key: string | null | undefined): PlanDef & { key: string } {
  const k = PLAN_ALIASES[String(key || "")] || String(key || "");
  const p = PLANS[k] || PLANS.pro;
  return { key: PLANS[k] ? k : "pro", ...p };
}
export const FINAL_LEAD_STATES = ["WON", "LOST", "NO_RESPONSE", "UNSERVICEABLE", "JUNK", "DUPLICATE"];
export function activeRequests(workspaceId: string): number {
  return (db.prepare(`SELECT COUNT(*) c FROM leads WHERE workspace_id=? AND state NOT IN (${FINAL_LEAD_STATES.map(() => "?").join(",")})`).get(workspaceId, ...FINAL_LEAD_STATES) as any).c;
}
export function seatsUsed(workspaceId: string): number {
  return (db.prepare("SELECT COUNT(*) c FROM users WHERE workspace_id=? AND active=1").get(workspaceId) as any).c;
}
export function seatCheck(workspaceId: string): { ok: boolean; used: number; limit: number; plan: string } {
  const sub = ensureSubscription(workspaceId);
  const plan = planOf(sub.plan);
  const used = seatsUsed(workspaceId);
  return { ok: plan.users === 0 || used < plan.users, used, limit: plan.users, plan: plan.name };
}

export function ensureSubscription(workspaceId: string): any {
  let s = db.prepare("SELECT * FROM subscriptions WHERE workspace_id=?").get(workspaceId) as any;
  if (!s) {
    const trialEnd = new Date(Date.now() + 30 * 86400000).toISOString();
    db.prepare("INSERT INTO subscriptions (id,workspace_id,plan,status,current_period_end,created_at,updated_at) VALUES (?,?,?,?,?,?,?)")
      .run(uid("sub"), workspaceId, "pro", "trialing", trialEnd, now(), now());
    db.prepare("UPDATE workspaces SET trial_ends_at=? WHERE id=?").run(trialEnd, workspaceId);
    s = db.prepare("SELECT * FROM subscriptions WHERE workspace_id=?").get(workspaceId);
  }
  return s;
}

export function billingStatus(workspaceId: string): any {
  const s = ensureSubscription(workspaceId);
  const plan = planOf(s.plan);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const leadsThisMonth = (db.prepare("SELECT COUNT(*) c FROM leads WHERE workspace_id=? AND created_at>=?").get(workspaceId, monthStart.toISOString()) as any).c;
  const aiThisMonth = (db.prepare("SELECT COUNT(*) c FROM agent_runs WHERE workspace_id=? AND created_at>=?").get(workspaceId, monthStart.toISOString()) as any).c;
  const trialDaysLeft = s.status === "trialing" ? Math.max(0, Math.ceil((new Date(s.current_period_end).getTime() - Date.now()) / 86400000)) : null;
  const used = seatsUsed(workspaceId);
  const active = activeRequests(workspaceId);
  return { subscription: s, plan: { ...plan }, usage: { active_requests: active, active_allowance: plan.active_requests, active_pct: Math.round(100 * active / plan.active_requests), leads_this_month: leadsThisMonth, ai_actions_this_month: aiThisMonth, ai_limit: plan.ai_actions, users_used: used, users_limit: plan.users, seats_used: used, seats_limit: plan.users, seats_pct: plan.users ? Math.round(100 * used / plan.users) : 0 }, trial_days_left: trialDaysLeft, access: s.status === "trialing" && trialDaysLeft === 0 ? "expired" : ["trialing", "active", "past_due"].includes(s.status) ? "ok" : s.status };
}

// PRICING V2 never-block rule: usage NEVER refuses intake (a lost request is
// the one thing this product exists to prevent). Warn at 80% of the active-
// request allowance; only an expired trial stops ingestion.
export function ingestionAllowed(workspaceId: string): { allowed: boolean; warn: boolean; reason?: string } {
  const b = billingStatus(workspaceId);
  if (b.access === "expired") return { allowed: false, warn: false, reason: "trial_expired" };
  return { allowed: true, warn: b.usage.active_pct >= 80 };
}

export async function createCheckout(workspaceId: string, planKey: string, baseUrl: string, period: string = "annual"): Promise<any> {
  const resolved = planOf(planKey);
  const plan = PLANS[resolved.key];
  if (!plan) return { error: "unknown_plan" };
  if (plan.custom) return { configured: false, custom: true, message: "Enterprise is custom-priced — email hello@workpile.io with your operation's size and we'll scope it with you.", plan: resolved.key };
  const monthly = period === "monthly";
  const key = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env[monthly ? plan.price_env_monthly : plan.price_env] || (monthly ? (plan.legacy_env_monthly ? process.env[plan.legacy_env_monthly] : undefined) : (plan.legacy_env ? process.env[plan.legacy_env] : undefined));
  if (!key || !priceId) return { configured: false, message: "Stripe billing is not configured on this deployment yet (needs STRIPE_SECRET_KEY + price IDs). Plans and trials work; checkout opens when keys are set.", plan: resolved.key, period: monthly ? "monthly" : "annual" };
  const s = ensureSubscription(workspaceId);
  const body = new URLSearchParams({ mode: "subscription", success_url: `${baseUrl}/billing/success`, cancel_url: `${baseUrl}/billing/cancelled`, "line_items[0][quantity]": "1", "line_items[0][price]": priceId, "automatic_tax[enabled]": "true", "metadata[workspace_id]": workspaceId, "metadata[plan]": resolved.key });
  if (s.stripe_customer_id) body.set("customer", s.stripe_customer_id);
  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" }, body });
  const j: any = await r.json();
  if (!r.ok) return { error: j.error?.message || "stripe_error" };
  return { configured: true, url: j.url, period: monthly ? "monthly" : "annual" };
}

export function handleBillingEvent(event: any): boolean {
  const wsId = event.data?.object?.metadata?.workspace_id || event.data?.object?.client_reference_id;
  const obj = event.data?.object || {};
  if (event.type === "checkout.session.completed" && wsId) {
    db.prepare("UPDATE subscriptions SET status='active', stripe_customer_id=?, stripe_subscription_id=?, plan=COALESCE(?,plan), updated_at=? WHERE workspace_id=?")
      .run(obj.customer || null, obj.subscription || null, obj.metadata?.plan || null, now(), wsId);
    return true;
  }
  if (["customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
    const sub = db.prepare("SELECT * FROM subscriptions WHERE stripe_customer_id=?").get(obj.customer) as any;
    if (sub) { db.prepare("UPDATE subscriptions SET status=?, current_period_end=?, updated_at=? WHERE id=?").run(event.type.endsWith("deleted") ? "canceled" : obj.status, obj.current_period_end ? new Date(obj.current_period_end * 1000).toISOString() : sub.current_period_end, now(), sub.id); return true; }
  }
  if (event.type === "invoice.payment_failed") {
    const sub = db.prepare("SELECT * FROM subscriptions WHERE stripe_customer_id=?").get(obj.customer) as any;
    if (sub) { db.prepare("UPDATE subscriptions SET status='past_due', updated_at=? WHERE id=?").run(now(), sub.id); return true; }
  }
  return false;
}

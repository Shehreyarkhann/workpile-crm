// Workpile — own subscription billing (§18 pricing, §26 C4 billing completeness)
// Plans mirror spec §18. Trial: 30 days, app-side, no card (proven ClaimPaid pattern).
// Stripe Checkout when STRIPE_SECRET_KEY + price IDs are set; otherwise checkout is
// honestly reported as not configured — never a fake payment flow for real money.
import { db, uid, now } from "./db.ts";

export const PLANS: Record<string, { name: string; price: number; seats: number; leads_per_month: number; ai_actions: number; price_env: string }> = {
  starter: { name: "Starter", price: 299, seats: 5, leads_per_month: 500, ai_actions: 1000, price_env: "STRIPE_PRICE_STARTER" },
  growth: { name: "Growth", price: 599, seats: 15, leads_per_month: 2000, ai_actions: 5000, price_env: "STRIPE_PRICE_GROWTH" },
  pro: { name: "Pro", price: 999, seats: 30, leads_per_month: 100000, ai_actions: 20000, price_env: "STRIPE_PRICE_PRO" },
};

export function ensureSubscription(workspaceId: string): any {
  let s = db.prepare("SELECT * FROM subscriptions WHERE workspace_id=?").get(workspaceId) as any;
  if (!s) {
    const trialEnd = new Date(Date.now() + 30 * 86400000).toISOString();
    db.prepare("INSERT INTO subscriptions (id,workspace_id,plan,status,current_period_end,created_at,updated_at) VALUES (?,?,?,?,?,?,?)")
      .run(uid("sub"), workspaceId, "growth", "trialing", trialEnd, now(), now());
    db.prepare("UPDATE workspaces SET trial_ends_at=? WHERE id=?").run(trialEnd, workspaceId);
    s = db.prepare("SELECT * FROM subscriptions WHERE workspace_id=?").get(workspaceId);
  }
  return s;
}

export function billingStatus(workspaceId: string): any {
  const s = ensureSubscription(workspaceId);
  const plan = PLANS[s.plan] || PLANS.growth;
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const leadsThisMonth = (db.prepare("SELECT COUNT(*) c FROM leads WHERE workspace_id=? AND created_at>=?").get(workspaceId, monthStart.toISOString()) as any).c;
  const aiThisMonth = (db.prepare("SELECT COUNT(*) c FROM agent_runs WHERE workspace_id=? AND created_at>=?").get(workspaceId, monthStart.toISOString()) as any).c;
  const trialDaysLeft = s.status === "trialing" ? Math.max(0, Math.ceil((new Date(s.current_period_end).getTime() - Date.now()) / 86400000)) : null;
  return { subscription: s, plan: { key: s.plan, ...plan }, usage: { leads_this_month: leadsThisMonth, leads_limit: plan.leads_per_month, leads_pct: Math.round(100 * leadsThisMonth / plan.leads_per_month), ai_actions_this_month: aiThisMonth, ai_limit: plan.ai_actions }, trial_days_left: trialDaysLeft, access: s.status === "trialing" && trialDaysLeft === 0 ? "expired" : ["trialing", "active", "past_due"].includes(s.status) ? "ok" : s.status };
}

// §26 C4: soft-warn at 80%, hard-stop only on ingestion caps — approvals NEVER blocked
export function ingestionAllowed(workspaceId: string): { allowed: boolean; warn: boolean; reason?: string } {
  const b = billingStatus(workspaceId);
  if (b.access === "expired") return { allowed: false, warn: false, reason: "trial_expired" };
  if (b.usage.leads_this_month >= b.usage.leads_limit) return { allowed: false, warn: true, reason: "plan_lead_cap" };
  return { allowed: true, warn: b.usage.leads_pct >= 80 };
}

export async function createCheckout(workspaceId: string, planKey: string, baseUrl: string): Promise<any> {
  const plan = PLANS[planKey];
  if (!plan) return { error: "unknown_plan" };
  const key = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env[plan.price_env];
  if (!key || !priceId) return { configured: false, message: "Stripe billing is not configured on this deployment yet (needs STRIPE_SECRET_KEY + price IDs). Plans and trials work; checkout opens when keys are set.", plan: planKey };
  const s = ensureSubscription(workspaceId);
  const body = new URLSearchParams({ mode: "subscription", success_url: `${baseUrl}/billing/success`, cancel_url: `${baseUrl}/billing/cancelled`, "line_items[0][quantity]": "1", "line_items[0][price]": priceId, "automatic_tax[enabled]": "true", "metadata[workspace_id]": workspaceId, "metadata[plan]": planKey });
  if (s.stripe_customer_id) body.set("customer", s.stripe_customer_id);
  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" }, body });
  const j: any = await r.json();
  if (!r.ok) return { error: j.error?.message || "stripe_error" };
  return { configured: true, url: j.url };
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

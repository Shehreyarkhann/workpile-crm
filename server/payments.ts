// LeadFlow OS — deposit payments (§26 A2 money bridge)
// Production path: Stripe Checkout when STRIPE_SECRET_KEY is set. Until then the app
// runs in explicit TEST MODE: a local pay page simulates the deposit and flips status
// through the exact same code path the Stripe webhook uses — screens and data upgrade
// automatically on the key swap, no code change (same pattern as spec §14.5 test mode).
import { createHmac, timingSafeEqual } from "node:crypto";
import { db, uid, now } from "./db.ts";

export function stripeMode(): "live" | "test" { return process.env.STRIPE_SECRET_KEY ? "live" : "test"; }

export async function createDeposit(proposalId: string, baseUrl: string): Promise<any | null> {
  const p = db.prepare("SELECT * FROM proposals WHERE id=?").get(proposalId) as any;
  if (!p) return null;
  const ws = db.prepare("SELECT * FROM workspaces WHERE id=?").get(p.workspace_id) as any;
  const pct = ws.deposit_pct ?? 25;
  const amount = Math.round(p.total * pct) / 100;
  const id = uid("pay");
  const mode = stripeMode();
  let link: string, sessionId: string | null = null;
  if (mode === "live") {
    const body = new URLSearchParams({
      mode: "payment", success_url: `${baseUrl}/p/paid`, cancel_url: `${baseUrl}/p/cancelled`,
      "line_items[0][quantity]": "1", "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(Math.round(amount * 100)),
      "line_items[0][price_data][product_data][name]": `Deposit (${pct}%) — proposal ${p.id}`,
      "metadata[proposal_id]": p.id, "metadata[payment_id]": id,
    });
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" }, body });
    const j: any = await r.json();
    if (!r.ok) throw new Error("Stripe: " + (j.error?.message || r.status));
    link = j.url; sessionId = j.id;
  } else {
    link = `${baseUrl}/pay/test/${id}`;
  }
  db.prepare("INSERT INTO payments (id,workspace_id,proposal_id,amount,mode,stripe_session_id,status,link,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(id, p.workspace_id, p.id, amount, mode, sessionId, "pending", link, now());
  db.prepare("UPDATE proposals SET payment_status='deposit_pending' WHERE id=?").run(p.id);
  return db.prepare("SELECT * FROM payments WHERE id=?").get(id);
}

export function markPaid(paymentId: string): boolean {
  const pay = db.prepare("SELECT * FROM payments WHERE id=?").get(paymentId) as any;
  if (!pay || pay.status === "paid") return false;
  db.prepare("UPDATE payments SET status='paid', paid_at=? WHERE id=?").run(now(), paymentId);
  db.prepare("UPDATE proposals SET payment_status='deposit_paid' WHERE id=?").run(pay.proposal_id);
  db.prepare("INSERT INTO outbox (id,workspace_id,kind,payload,idempotency_key,created_at) VALUES (?,?,?,?,?,?)")
    .run(uid("out"), pay.workspace_id, "payment.deposit_paid", JSON.stringify({ payment_id: paymentId, proposal_id: pay.proposal_id, amount: pay.amount }), `pay-${paymentId}`, now());
  return true;
}

// Stripe webhook signature verification (t=...,v1=...) — §26: unsigned webhooks are rejected
export function verifyStripeSignature(rawBody: string, header: string, secret: string, toleranceSec = 300): boolean {
  try {
    const parts = Object.fromEntries(header.split(",").map(kv => kv.split("=") as any));
    const t = parts.t, v1 = parts.v1;
    if (!t || !v1) return false;
    if (Math.abs(Date.now() / 1000 - Number(t)) > toleranceSec) return false;
    const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
    return timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  } catch { return false; }
}

export function handleStripeEvent(event: any): boolean {
  if (event.type === "checkout.session.completed") {
    const pid = event.data?.object?.metadata?.payment_id;
    if (pid) return markPaid(pid);
  }
  return false;
}

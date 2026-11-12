// Workpile — deposit payments (§26 A2 money bridge)
// Production path: Stripe Checkout when STRIPE_SECRET_KEY is set. Until then the app
// runs in explicit TEST MODE: a local pay page simulates the deposit and flips status
// through the exact same code path the Stripe webhook uses — screens and data upgrade
// automatically on the key swap, no code change (same pattern as spec §14.5 test mode).
import { createHmac, timingSafeEqual } from "node:crypto";
import { db, uid, now } from "./db.ts";
import { emitEvent } from "./integrations.ts";
import { notifyOwners } from "./comms.ts";
import { onInvoicePaid } from "./lifecycle.ts";

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
  db.prepare("INSERT INTO payments (id,workspace_id,proposal_id,kind,amount,mode,stripe_session_id,status,link,created_at) VALUES (?,?,?,'deposit',?,?,?,?,?,?)")
    .run(id, p.workspace_id, p.id, amount, mode, sessionId, "pending", link, now());
  db.prepare("UPDATE proposals SET payment_status='deposit_pending' WHERE id=?").run(p.id);
  return db.prepare("SELECT * FROM payments WHERE id=?").get(id);
}

export async function createInvoicePayment(invoiceId: string, baseUrl: string): Promise<any | null> {
  const inv = db.prepare("SELECT * FROM invoices WHERE id=?").get(invoiceId) as any;
  if (!inv || inv.status === "void") return null;
  const balance = Math.round(((inv.total || 0) - (inv.paid_amount || 0)) * 100) / 100;
  if (balance <= 0) return null;
  const pending = db.prepare("SELECT * FROM payments WHERE invoice_id=? AND status='pending' ORDER BY created_at DESC").get(invoiceId) as any;
  if (pending) return pending;
  const id = uid("pay");
  const mode = stripeMode();
  let link: string, sessionId: string | null = null;
  if (mode === "live") {
    const body = new URLSearchParams({
      mode: "payment", success_url: `${baseUrl}/invoice/${inv.token}?paid=1`, cancel_url: `${baseUrl}/invoice/${inv.token}`,
      "line_items[0][quantity]": "1", "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(Math.round(balance * 100)),
      "line_items[0][price_data][product_data][name]": `Invoice ${inv.number} — balance due`,
      "metadata[invoice_id]": inv.id, "metadata[payment_id]": id,
    });
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" }, body });
    const j: any = await r.json();
    if (!r.ok) throw new Error("Stripe: " + (j.error?.message || r.status));
    link = j.url; sessionId = j.id;
  } else {
    link = `${baseUrl}/pay/test/${id}`;
  }
  db.prepare("INSERT INTO payments (id,workspace_id,proposal_id,invoice_id,kind,amount,mode,stripe_session_id,status,link,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .run(id, inv.workspace_id, null, inv.id, "invoice", balance, mode, sessionId, "pending", link, now());
  return db.prepare("SELECT * FROM payments WHERE id=?").get(id);
}

// v52 deposit crediting: deposits collected against a lead's proposals are
// real money already in hand. When an invoice is created for that lead, the
// unapplied deposit balance credits the invoice — the customer is never
// billed the deposit twice. Allocations are recorded as 'deposit_credit'
// rows (status 'applied', NOT 'paid') so collected-cash never double-counts.
export function depositsAvailable(ws: string, leadId: string): number {
  if (!leadId) return 0;
  const paid = (db.prepare("SELECT COALESCE(SUM(p.amount),0) v FROM payments p JOIN proposals pr ON pr.id=p.proposal_id WHERE p.workspace_id=? AND pr.lead_id=? AND p.status='paid' AND (p.kind='deposit' OR p.kind IS NULL)").get(ws, leadId) as any)?.v || 0;
  const applied = (db.prepare("SELECT COALESCE(SUM(p.amount),0) v FROM payments p JOIN invoices i ON i.id=p.invoice_id WHERE p.workspace_id=? AND i.lead_id=? AND p.kind='deposit_credit' AND p.status='applied'").get(ws, leadId) as any)?.v || 0;
  return Math.round((paid - applied) * 100) / 100;
}
export function applyDepositsToInvoice(ws: string, inv: any): number {
  if (!inv || inv.status === "void" || !inv.lead_id) return 0;
  const balance = Math.round(((inv.total || 0) - (inv.paid_amount || 0)) * 100) / 100;
  if (balance <= 0) return 0;
  const credit = Math.min(balance, Math.max(0, depositsAvailable(ws, inv.lead_id)));
  if (credit <= 0) return 0;
  db.prepare("INSERT INTO payments (id,workspace_id,proposal_id,invoice_id,kind,amount,mode,status,created_at,paid_at) VALUES (?,?,?,?,'deposit_credit',?,'internal','applied',?,?)").run(uid("pay"), ws, inv.proposal_id || null, inv.id, credit, now(), now());
  const paidAmt = Math.round(((inv.paid_amount || 0) + credit) * 100) / 100;
  const full = paidAmt >= (inv.total || 0) - 0.001;
  db.prepare("UPDATE invoices SET paid_amount=?, status=? WHERE id=?").run(paidAmt, full ? "paid" : "partially_paid", inv.id);
  if (full && inv.job_id) db.prepare("UPDATE jobs SET invoice_status='paid' WHERE id=?").run(inv.job_id);
  if (full) { try { onInvoicePaid(ws, inv.lead_id); } catch { /* hook never blocks crediting */ } }
  return credit;
}

export function markPaid(paymentId: string): boolean {
  const pay = db.prepare("SELECT * FROM payments WHERE id=?").get(paymentId) as any;
  if (!pay || pay.status === "paid") return false;
  db.prepare("UPDATE payments SET status='paid', paid_at=? WHERE id=?").run(now(), paymentId);
  if (pay.invoice_id) {
    const inv = db.prepare("SELECT * FROM invoices WHERE id=?").get(pay.invoice_id) as any;
    if (inv) {
      const paidAmount = Math.min(inv.total || 0, Math.round(((inv.paid_amount || 0) + (pay.amount || 0)) * 100) / 100);
      const full = paidAmount >= (inv.total || 0);
      db.prepare("UPDATE invoices SET paid_amount=?, status=? WHERE id=?").run(paidAmount, full ? "paid" : "partially_paid", inv.id);
      if (full && inv.job_id) db.prepare("UPDATE jobs SET invoice_status='paid' WHERE id=?").run(inv.job_id);
      if (full && inv.lead_id) { try { onInvoicePaid(pay.workspace_id, inv.lead_id); } catch { /* lifecycle hook never blocks a payment */ } }
      emitEvent(pay.workspace_id, "invoice.paid", { lead_id: inv.lead_id, invoice_id: inv.id, amount: pay.amount });
      notifyOwners(pay.workspace_id, "invoice.paid", "Invoice paid 💳", `Invoice ${inv.number} — $${pay.amount} received${full ? " in full" : ""}.`, inv.lead_id);
      db.prepare("INSERT INTO outbox (id,workspace_id,kind,payload,idempotency_key,created_at) VALUES (?,?,?,?,?,?)")
        .run(uid("out"), pay.workspace_id, "payment.invoice_paid", JSON.stringify({ payment_id: paymentId, invoice_id: inv.id, amount: pay.amount }), `pay-${paymentId}`, now());
    }
    return true;
  }
  db.prepare("UPDATE proposals SET payment_status='deposit_paid' WHERE id=?").run(pay.proposal_id);
  const prop2 = db.prepare("SELECT lead_id FROM proposals WHERE id=?").get(pay.proposal_id) as any;
  emitEvent(pay.workspace_id, "deposit.paid", { lead_id: prop2?.lead_id, proposal_id: pay.proposal_id, amount: pay.amount });
  notifyOwners(pay.workspace_id, "deposit.paid", "Deposit paid 💳", `Deposit of $${pay.amount} received on proposal ${pay.proposal_id}`, prop2?.lead_id);
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

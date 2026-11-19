// Workpile — QuickBooks Online connect + invoice push (v46).
// Same honesty rule as mail sync: the full OAuth + API flow is coded, and it
// activates only when the deployment registers an Intuit app
// (INTUIT_CLIENT_ID / INTUIT_CLIENT_SECRET). Until then every entry point
// reports not_configured — no fake connection, no fake sync. Pushing an
// invoice creates the customer in QBO if needed, posts the invoice with the
// same lines, and records the QBO id back on the Workpile invoice.
import { db, uid, now } from "./db.ts";
import { randomBytes } from "node:crypto";

db.exec(`CREATE TABLE IF NOT EXISTS quickbooks_connections (workspace_id TEXT PRIMARY KEY, realm_id TEXT, refresh_token TEXT, status TEXT DEFAULT 'connected', created_at TEXT, updated_at TEXT);`);

type FetchFn = (url: string, init?: any) => Promise<{ status: number; json: () => Promise<any> }>;
const realFetch: FetchFn = fetch as any;
export function qbConfigured(): boolean { return !!(process.env.INTUIT_CLIENT_ID && process.env.INTUIT_CLIENT_SECRET); }
function apiBase(): string { return process.env.INTUIT_ENV === "sandbox" ? "https://sandbox-quickbooks.api.intuit.com" : "https://quickbooks.api.intuit.com"; }
export function qbAuthUrl(workspaceId: string, redirectUri: string): string {
  const state = randomBytes(16).toString("hex") + "." + workspaceId;
  const u = new URL("https://appcenter.intuit.com/connect/oauth2");
  u.searchParams.set("client_id", process.env.INTUIT_CLIENT_ID!); u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code"); u.searchParams.set("scope", "com.intuit.quickbooks.accounting"); u.searchParams.set("state", state);
  return u.toString();
}
async function qbToken(form: Record<string, string>, fetchFn: FetchFn) {
  const auth = Buffer.from(`${process.env.INTUIT_CLIENT_ID}:${process.env.INTUIT_CLIENT_SECRET}`).toString("base64");
  const r = await fetchFn("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: new URLSearchParams(form).toString() });
  const j = await r.json().catch(() => ({}));
  if (r.status < 200 || r.status >= 300 || !j.access_token) throw new Error("Intuit token " + r.status + " " + JSON.stringify(j).slice(0, 140));
  return j;
}
export async function qbExchange(code: string, redirectUri: string, fetchFn: FetchFn = realFetch) { return qbToken({ code, grant_type: "authorization_code", redirect_uri: redirectUri }, fetchFn); }
async function qbAccess(conn: any, fetchFn: FetchFn): Promise<string> {
  const j = await qbToken({ grant_type: "refresh_token", refresh_token: conn.refresh_token }, fetchFn);
  if (j.refresh_token && j.refresh_token !== conn.refresh_token) db.prepare("UPDATE quickbooks_connections SET refresh_token=?, updated_at=? WHERE workspace_id=?").run(j.refresh_token, now(), conn.workspace_id);
  return j.access_token;
}
export function qbConnection(workspaceId: string) { return db.prepare("SELECT workspace_id, realm_id, status, created_at, updated_at FROM quickbooks_connections WHERE workspace_id=? AND status='connected'").get(workspaceId) as any; }
async function qbCall(conn: any, method: string, pathQ: string, body: any, token: string, fetchFn: FetchFn) {
  const r = await fetchFn(`${apiBase()}/v3/company/${conn.realm_id}/${pathQ}`, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status < 200 || r.status >= 300) throw new Error("QBO " + method + " " + pathQ.split("?")[0] + " -> " + r.status + " " + JSON.stringify(j).slice(0, 160));
  return j;
}
export async function pushInvoiceToQb(workspaceId: string, invoiceId: string, fetchFn: FetchFn = realFetch): Promise<any> {
  const conn = db.prepare("SELECT * FROM quickbooks_connections WHERE workspace_id=? AND status='connected'").get(workspaceId) as any;
  if (!conn) { const e: any = new Error("QuickBooks is not connected for this workspace."); e.code = "qb_not_connected"; throw e; }
  const inv = db.prepare("SELECT * FROM invoices WHERE id=? AND workspace_id=?").get(invoiceId, workspaceId) as any;
  if (!inv) { const e: any = new Error("invoice not found"); e.code = "not_found"; throw e; }
  if (inv.status === "void") { const e: any = new Error("void invoices are never pushed to QuickBooks"); e.code = "invoice_void"; throw e; }
  if (inv.qb_id) return { qb_id: inv.qb_id, already: true };
  const token = await qbAccess(conn, fetchFn);
  const customerId = await qbCustomerId(conn, inv, token, fetchFn);
  let lines: any[] = []; try { lines = JSON.parse(inv.lines || "[]"); } catch { lines = []; }
  const qbLines = (lines.length ? lines : [{ description: "Services rendered", qty: 1, unit_price: inv.total }]).map((l: any) => {
    const qty = Number(l.qty) || 1; const rate = Number(l.unit_price ?? l.price ?? (l.amount ? l.amount / qty : 0)) || 0;
    return { Amount: Math.round(qty * rate * 100) / 100, DetailType: "SalesItemLineDetail", Description: String(l.description || l.name || "Service").slice(0, 4000), SalesItemLineDetail: { Qty: qty, UnitPrice: rate } };
  });
  const posted = await qbCall(conn, "POST", "invoice", { CustomerRef: { value: String(customerId) }, Line: qbLines }, token, fetchFn);
  const qbId = String(posted?.Invoice?.Id || "");
  if (!qbId) throw new Error("QBO did not return an invoice id");
  db.prepare("UPDATE invoices SET qb_id=?, qb_synced_at=? WHERE id=?").run(qbId, now(), inv.id);
  return { qb_id: qbId };
}

// v104 — resolve (or create) the QBO customer for an invoice's lead.
export async function qbCustomerId(conn: any, inv: any, token: string, fetchFn: FetchFn = realFetch): Promise<string> {
  const lead = inv.lead_id ? db.prepare("SELECT * FROM leads WHERE id=?").get(inv.lead_id) as any : null;
  const contact = lead?.contact_id ? db.prepare("SELECT * FROM contacts WHERE id=?").get(lead.contact_id) as any : null;
  const customerName = (contact?.company || contact?.name || lead?.contact_name || "Workpile customer").slice(0, 100);
  const q = await qbCall(conn, "GET", `query?query=${encodeURIComponent(`select * from Customer where DisplayName = '${customerName.replace(/'/g, "\\'")}'`)}`, null, token, fetchFn);
  let customerId = q?.QueryResponse?.Customer?.[0]?.Id;
  if (!customerId) { const created = await qbCall(conn, "POST", "customer", { DisplayName: customerName, ...(contact?.email ? { PrimaryEmailAddr: { Address: contact.email } } : {}) }, token, fetchFn); customerId = created?.Customer?.Id; }
  return String(customerId);
}

// v104 — every paid payment (invoice payment or proposal deposit) lands in
// QuickBooks as a Payment linked to its invoice. Deposits taken before an
// invoice exists defer (awaiting_invoice) and resolve on the next sweep.
export async function pushPaymentToQb(workspaceId: string, paymentId: string, fetchFn: FetchFn = realFetch): Promise<any> {
  const conn = db.prepare("SELECT * FROM quickbooks_connections WHERE workspace_id=? AND status='connected'").get(workspaceId) as any;
  if (!conn) return { skipped: "qb_not_connected" };
  const pay = db.prepare("SELECT * FROM payments WHERE id=? AND workspace_id=?").get(paymentId, workspaceId) as any;
  if (!pay) return { skipped: "not_found" };
  if (pay.status !== "paid") return { skipped: "not_paid" };
  if (pay.qb_id) return { qb_id: pay.qb_id, already: true };
  try {
    let inv: any = null;
    if (pay.invoice_id) inv = db.prepare("SELECT * FROM invoices WHERE id=?").get(pay.invoice_id) as any;
    if (!inv && pay.proposal_id) {
      const prop = db.prepare("SELECT lead_id FROM proposals WHERE id=?").get(pay.proposal_id) as any;
      if (prop?.lead_id) inv = db.prepare("SELECT * FROM invoices WHERE lead_id=? AND status!='void' ORDER BY created_at DESC").get(prop.lead_id) as any;
    }
    if (!inv) return { deferred: "awaiting_invoice" };
    if (!inv.qb_id) await pushInvoiceToQb(workspaceId, inv.id, fetchFn);
    inv = db.prepare("SELECT * FROM invoices WHERE id=?").get(inv.id) as any;
    const token = await qbAccess(conn, fetchFn);
    const customerId = await qbCustomerId(conn, inv, token, fetchFn);
    const posted = await qbCall(conn, "POST", "payment", { CustomerRef: { value: String(customerId) }, TotalAmt: pay.amount, TxnDate: String(pay.paid_at || now()).slice(0, 10), Line: [{ Amount: pay.amount, LinkedTxn: [{ TxnId: String(inv.qb_id), TxnType: "Invoice" }] }] }, token, fetchFn);
    const qbId = String(posted?.Payment?.Id || "");
    if (!qbId) throw new Error("QBO did not return a payment id");
    db.prepare("UPDATE payments SET qb_id=?, qb_error=NULL WHERE id=?").run(qbId, pay.id);
    return { qb_id: qbId };
  } catch (e: any) {
    db.prepare("UPDATE payments SET qb_error=? WHERE id=?").run(String(e?.message || e).slice(0, 300), pay.id);
    return { error: String(e?.message || e) };
  }
}

export async function syncPendingPayments(workspaceId: string, fetchFn: FetchFn = realFetch): Promise<{ synced: number; deferred: number; failed: number }> {
  const rows = db.prepare("SELECT id FROM payments WHERE workspace_id=? AND status='paid' AND qb_id IS NULL ORDER BY created_at LIMIT 50").all(workspaceId) as any[];
  let synced = 0, deferred = 0, failed = 0;
  for (const r of rows) { const out = await pushPaymentToQb(workspaceId, r.id, fetchFn); if (out.qb_id) synced++; else if (out.deferred) deferred++; else if (out.error) failed++; }
  return { synced, deferred, failed };
}

export function qbPaymentSyncCounts(workspaceId: string): { synced: number; pending: number; failed: number } {
  const synced = (db.prepare("SELECT COUNT(*) c FROM payments WHERE workspace_id=? AND status='paid' AND qb_id IS NOT NULL").get(workspaceId) as any).c;
  const failed = (db.prepare("SELECT COUNT(*) c FROM payments WHERE workspace_id=? AND status='paid' AND qb_id IS NULL AND qb_error IS NOT NULL").get(workspaceId) as any).c;
  const pending = (db.prepare("SELECT COUNT(*) c FROM payments WHERE workspace_id=? AND status='paid' AND qb_id IS NULL AND qb_error IS NULL").get(workspaceId) as any).c;
  return { synced, pending, failed };
}

// Workpile — deliverability (v44, Tranche 3 of the Instantly scope).
// Sender identities (multiple From addresses on the workspace's verified
// sending domain, rotated by campaigns), warmup guidance (age-based daily
// recommendations, honestly labeled as guidance — Workpile has no warmup
// pool network and does not pretend to), live DNS authentication checks
// (SPF / DKIM / DMARC / MX on the sending subdomain), and failure-rate
// guardrails (campaigns auto-pause above a 5% delivery-failure rate).
import { db, uid, now } from "./db.ts";
import dns from "node:dns/promises";

export function ensureIdentities(workspaceId: string): any[] {
  let rows = db.prepare("SELECT * FROM sender_identities WHERE workspace_id=? ORDER BY created_at").all(workspaceId) as any[];
  if (!rows.length) {
    const ws = db.prepare("SELECT * FROM workspaces WHERE id=?").get(workspaceId) as any;
    if (ws?.from_email) {
      db.prepare("INSERT INTO sender_identities (id,workspace_id,name,email,daily_limit,active,is_default,warmup_override,created_at) VALUES (?,?,?,?,30,1,1,0,?)").run(uid("snd"), workspaceId, ws.from_name || ws.name || "Default sender", ws.from_email, ws.created_at || now());
      rows = db.prepare("SELECT * FROM sender_identities WHERE workspace_id=? ORDER BY created_at").all(workspaceId) as any[];
    }
  }
  return rows;
}
export function warmupRecommended(identity: any, on: Date): number {
  const ageDays = Math.max(0, Math.floor((on.getTime() - new Date(identity.created_at).getTime()) / 86400000));
  if (ageDays < 7) return 10;
  if (ageDays < 14) return 20;
  if (ageDays < 21) return 30;
  return Number.POSITIVE_INFINITY;
}
export function effectiveSenderLimit(identity: any, on: Date): number {
  const cap = Math.max(1, Number(identity.daily_limit) || 30);
  if (identity.warmup_override) return cap;
  return Math.min(cap, warmupRecommended(identity, on));
}
export function senderSentToday(senderId: string, on: Date): number {
  const day = on.toISOString().slice(0, 10);
  return (db.prepare("SELECT COUNT(*) n FROM campaign_sends WHERE sender_id=? AND status='sent' AND substr(created_at,1,10)=?").get(senderId, day) as any).n || 0;
}
export function identityView(identity: any, on: Date) {
  const rec = warmupRecommended(identity, on);
  return { ...identity, sent_today: senderSentToday(identity.id, on), effective_limit: effectiveSenderLimit(identity, on), warmup_recommended: rec === Number.POSITIVE_INFINITY ? null : rec, warmup_complete: rec === Number.POSITIVE_INFINITY };
}
// Pick the sender for the next campaign email. Rotation walks the active
// identities from a rotating offset and takes the first with capacity left;
// 'specific' pins one identity; 'default' uses the workspace default. When
// every candidate is at its effective limit the caller defers to tomorrow.
export function pickSender(campaign: any, workspaceId: string, on: Date, rotationIdx: number): { identity: any | null; exhausted: boolean } {
  const actives = ensureIdentities(workspaceId).filter(i => i.active);
  if (!actives.length) return { identity: null, exhausted: false }; // legacy single-sender behavior (workspace from_email)
  let candidates = actives;
  if (campaign.sender_mode === "specific" && campaign.sender_id) candidates = actives.filter(i => i.id === campaign.sender_id);
  else if (campaign.sender_mode === "default") candidates = actives.filter(i => i.is_default).slice(0, 1).length ? actives.filter(i => i.is_default).slice(0, 1) : actives.slice(0, 1);
  else if (campaign.sender_mode === "rotate") { const start = ((rotationIdx % actives.length) + actives.length) % actives.length; candidates = [...actives.slice(start), ...actives.slice(0, start)]; }
  for (const i of candidates) if (senderSentToday(i.id, on) < effectiveSenderLimit(i, on)) return { identity: i, exhausted: false };
  return { identity: null, exhausted: true };
}

// ---------- DNS authentication checks ----------
async function txt(host: string): Promise<string[]> {
  try { const r = await Promise.race([dns.resolveTxt(host), new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 3500))]); return (r as string[][]).map(parts => parts.join("")); }
  catch { return []; }
}
async function mx(host: string): Promise<string[]> {
  try { const r = await Promise.race([dns.resolveMx(host), new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 3500))]); return (r as any[]).map(x => x.exchange); }
  catch { return []; }
}
export async function domainChecks(domain: string) {
  const send = "send." + domain;
  const [spf, dkim, dmarc, mxr] = await Promise.all([txt(send), txt("resend._domainkey." + send), txt("_dmarc." + domain), mx(send)]);
  const checked = spf.length || dkim.length || dmarc.length || mxr.length;
  const unreach = !checked;
  const find = (arr: string[], re: RegExp) => arr.find(v => re.test(v));
  return [
    { key: "spf", label: "SPF — send." + domain, status: unreach ? "unknown" : find(spf, /v=spf1/i) ? "pass" : "fail", detail: find(spf, /v=spf1/i) || (unreach ? "Could not check from this server — verify in your DNS console." : "No SPF record found on the sending subdomain.") },
    { key: "dkim", label: "DKIM — resend._domainkey.send." + domain, status: unreach ? "unknown" : find(dkim, /p=|v=DKIM1/i) ? "pass" : "fail", detail: find(dkim, /p=/i) ? "DKIM key record present." : (unreach ? "Could not check from this server." : "No DKIM key found — email will fail authentication.") },
    { key: "dmarc", label: "DMARC — _dmarc." + domain, status: unreach ? "unknown" : find(dmarc, /v=DMARC1/i) ? "pass" : "warn", detail: find(dmarc, /v=DMARC1/i) || (unreach ? "Could not check from this server." : "No DMARC policy — recommended: v=DMARC1; p=none; to start.") },
    { key: "mx", label: "MX (bounces) — send." + domain, status: unreach ? "unknown" : mxr.length ? "pass" : "warn", detail: mxr[0] || (unreach ? "Could not check from this server." : "No MX on the sending subdomain — bounce handling may be incomplete.") },
  ];
}
export function failureStats(workspaceId: string, days = 30) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const row = db.prepare("SELECT SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END) sent, SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) failed FROM campaign_sends WHERE workspace_id=? AND created_at>=?").get(workspaceId, since) as any;
  const sent = row?.sent || 0, failed = row?.failed || 0;
  return { sent, failed, attempts: sent + failed, failure_rate: sent + failed ? Math.round((failed / (sent + failed)) * 1000) / 10 : null };
}

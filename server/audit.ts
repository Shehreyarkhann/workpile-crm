// Self-serve Backlog Audit (target §24/Phase 5): a prospect's exported lead list in,
// a scored recovery report out. Pure analysis over the submitted rows — nothing is
// written except an aggregate request record when an email is provided.
import { scoreLead } from "./ai.ts";

const pick = (r: any, keys: string[]) => { for (const k of Object.keys(r || {})) { const n = k.toLowerCase().replace(/[^a-z]/g, ""); if (keys.includes(n)) return r[k]; } return undefined; };
const money = (v: any) => { const n = Number(String(v ?? "").replace(/[^0-9.]/g, "")); return Number.isFinite(n) ? n : 0; };
const days = (v: any) => { const t = new Date(v || "").getTime(); return Number.isFinite(t) ? (Date.now() - t) / 86400000 : null; };

export function analyzeBacklog(rows: any[]) {
  const norm = (rows || []).map((r: any) => {
    const status = String(pick(r, ["status", "stage", "state"]) || "").toLowerCase();
    const created = pick(r, ["created", "createdat", "date", "datecreated"]);
    const ltRaw = pick(r, ["lastcontact", "lastcontactat", "lastactivity", "lasttouch", "updatedat", "updated"]);
    const lastTouch = ltRaw === "" || ltRaw === null ? undefined : ltRaw;
    const age = days(created); const idle = days(lastTouch ?? created);
    return {
      name: String(pick(r, ["name", "customer", "customername", "contact", "contactname", "lead"]) || "Unnamed"),
      phone: String(pick(r, ["phone", "phonenumber", "mobile", "cell"]) || ""),
      email: String(pick(r, ["email", "emailaddress"]) || ""),
      service: String(pick(r, ["service", "servicerequested", "job", "jobtype", "type"]) || ""),
      value: money(pick(r, ["value", "amount", "estvalue", "estimatedvalue", "price", "total"])),
      created_at: created ? new Date(created).toISOString() : new Date(0).toISOString(),
      age_days: age === null ? null : Math.round(age),
      idle_days: idle === null ? null : Math.round(idle),
      lost: /lost|dead|closedlost|unqualified|spam|junk/.test(status),
      won: /won|closedwon|sold|completed/.test(status),
      touched: lastTouch !== undefined && lastTouch !== null && String(lastTouch) !== "",
    };
  });
  const open = norm.filter(r => !r.lost && !r.won);
  const untouched = open.filter(r => !r.touched && (r.age_days === null || r.age_days >= 2));
  const stale = open.filter(r => r.idle_days !== null && r.idle_days >= 14);
  const recoverable = open.filter(r => (!r.touched && (r.age_days === null || r.age_days >= 2)) || (r.idle_days !== null && r.idle_days >= 14));
  const byKey = new Map<string, number>();
  for (const r of norm) { const k = r.phone.replace(/\D/g, "") || r.email.toLowerCase().trim(); if (k) byKey.set(k, (byKey.get(k) || 0) + 1); }
  const dupeRows = [...byKey.values()].filter(c => c > 1).reduce((a, c) => a + c - 1, 0);
  const scored = recoverable.map(r => { const s = scoreLead({ contact_phone: r.phone, contact_email: r.email, est_value: r.value, state: "NEW", created_at: r.created_at, owner_id: null, next_action_due_at: null }); return { name: r.name, service: r.service, value: r.value, score: s.score, temperature: s.temperature, issue: !r.touched ? "never contacted" : `idle ${r.idle_days}d` }; }).sort((a, b) => (b.score * Math.max(1, b.value)) - (a.score * Math.max(1, a.value)));
  return {
    rows: norm.length,
    total_value: norm.reduce((a, r) => a + r.value, 0),
    open_count: open.length,
    won_count: norm.filter(r => r.won).length,
    lost_count: norm.filter(r => !r.won && r.lost).length,
    untouched_count: untouched.length,
    stale_count: stale.length,
    duplicate_rows: dupeRows,
    recoverable_count: recoverable.length,
    recoverable_value: recoverable.reduce((a, r) => a + r.value, 0),
    top_opportunities: scored.slice(0, 10),
    method: "Recoverable = open rows (not won/lost) that were never contacted (2+ days old) or have had no activity in 14+ days. Values are the prospect's own exported figures, unadjusted. Scores use Workpile's standard lead scoring. This is an analysis of the file provided, not a revenue guarantee.",
  };
}

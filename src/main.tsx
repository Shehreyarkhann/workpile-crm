import React, { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

export const api = async (path: string, opts: any = {}) => {
  const r = await fetch(path, { method: opts.method || "GET", headers: { "Content-Type": "application/json" }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.code || j.error?.message || `HTTP ${r.status}`);
  return j;
};

// Offline field queue (§12.3): writes made with no signal are stored on-device and replayed in order.
export const offlineQueue = (): any[] => { try { return JSON.parse(localStorage.getItem("wp_offline_posts") || "[]"); } catch { return []; } };
export const offlinePost = async (url: string, body: any, label: string) => {
  try { return await api(url, { method: "POST", body }); }
  catch (e: any) {
    if (!navigator.onLine || /failed to fetch|networkerror|load failed/i.test(String(e?.message || e))) {
      const q = offlineQueue(); q.push({ url, body, label, at: new Date().toISOString() });
      localStorage.setItem("wp_offline_posts", JSON.stringify(q));
      return { __offline: true };
    }
    throw e;
  }
};
export const syncOffline = async () => {
  const q = offlineQueue(); if (!q.length) return;
  const left: any[] = [];
  for (const item of q) { try { await api(item.url, { method: "POST", body: item.body }); } catch { left.push(item); } }
  localStorage.setItem("wp_offline_posts", JSON.stringify(left));
  if (left.length < q.length) location.reload();
};
export // Live refresh (v27): refetch on window focus + every 30s while mounted, so
// views stay current without manual reloads. Cleanup is a proper function.
function useLive(fn: () => void, ms = 30000) { const ref = useRef(fn); ref.current = fn; useEffect(() => { const run = () => { try { ref.current(); } catch {} }; const onF = () => run(); window.addEventListener("focus", onF); const iv = setInterval(run, ms); return () => { window.removeEventListener("focus", onF); clearInterval(iv); }; }, [ms]); }
const money = (n: any) => "$" + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
export const num = (n: any) => Number(n || 0).toLocaleString();
export const dt = (s: any) => s ? new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
export const dOnly = (s: any) => s ? new Date(s).toLocaleDateString() : "—";
export const Badge = ({ s }: any) => <span className={`badge b-${s}`}>{String(s || "").replaceAll("_", " ")}</span>;
export const STATES = ["NEW", "WORKING", "QUALIFIED", "PROPOSAL", "SENT", "FOLLOWUP", "WON", "LOST", "NO_RESPONSE", "UNSERVICEABLE", "JUNK", "DUPLICATE"];
export const FINALS = ["WON", "LOST", "NO_RESPONSE", "UNSERVICEABLE", "JUNK", "DUPLICATE"];
export const JOB_STAGES = ["AWAITING_SCHEDULING", "SCHEDULED", "IN_PROGRESS", "ON_HOLD", "WORK_COMPLETED", "DOCUMENTATION_PENDING", "READY_TO_INVOICE", "INVOICED", "CLOSED", "CANCELLED"];
export const BUCKETS: [string, string][] = [["new", "New"], ["working", "Working"], ["proposal", "Proposal"], ["won", "Won"], ["closed", "Closed"]];
export const BOARD_STAGES: [string, string][] = [["NEW", "New"], ["WORKING", "Working"], ["QUALIFIED", "Qualified"], ["PROPOSAL", "Proposal"], ["SENT", "Sent"], ["FOLLOWUP", "Follow-up"], ["WON", "Won"], ["CLOSED", "Closed"]];
type Nav = { view: string; leads?: any; leadId?: string };


function GoalGauge({ pct, target }: any) { const p = Math.max(0, Math.min(100, pct || 0)); const R = 74, C = Math.PI * R; const ticks = [0, 25, 50, 75, 100];
  return (<div className="gaugeWrap"><svg width="190" height="112" viewBox="0 0 190 112">
    {ticks.map(t => { const a = Math.PI * (1 - t / 100); const x1 = 95 + (R + 7) * Math.cos(a), y1 = 100 - (R + 7) * Math.sin(a), x2 = 95 + (R - 9) * Math.cos(a), y2 = 100 - (R - 9) * Math.sin(a); return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} stroke={t <= p ? "#16a34a" : "#e2e8f0"} strokeWidth="5" strokeLinecap="round" />; })}
    <path d={`M ${95 - R} 100 A ${R} ${R} 0 0 1 ${95 + R} 100`} fill="none" stroke="#eef2f7" strokeWidth="13" strokeLinecap="round" />
    <path d={`M ${95 - R} 100 A ${R} ${R} 0 0 1 ${95 + R} 100`} fill="none" stroke="#16a34a" strokeWidth="13" strokeLinecap="round" strokeDasharray={`${C * p / 100} ${C}`} style={{ transition: "stroke-dasharray 1s cubic-bezier(.22,.9,.3,1)" }} />
    <text x="95" y="82" textAnchor="middle" fontSize="30" fontWeight="800" fill="#1b1b1a">{pct === null || pct === undefined ? "—" : pct + "%"}</text>
    <text x="95" y="100" textAnchor="middle" fontSize="11.5" fill="#94a3b8">of {target}% target</text>
  </svg></div>); }
function useCountUp(target: number, dur = 750) {
  const [v, setV] = useState(0);
  useEffect(() => { let raf = 0; const t0 = performance.now(); const step = (t: number) => { const p = Math.min(1, (t - t0) / dur); setV(Math.round(target * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(step); }; raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf); }, [target]);
  return v;
}

export function absInvLink(inv: any): string { if (!inv?.link) return ""; return inv.link.startsWith("http") ? inv.link : location.origin + inv.link; }
function InvoiceActions({ inv, onDone }: any) {
  const [msg, setMsg] = useState("");
  if (!inv || inv.status === "void") return null;
  const url = absInvLink(inv);
  return (<span className="rowflex" style={{ flexWrap: "wrap" }}>
    {url && <a className="btn ghost small" href={url} target="_blank" rel="noreferrer">👁 View / pay page</a>}
    {url && <button className="btn ghost small" onClick={async () => { try { await navigator.clipboard.writeText(url); toast("Pay link copied ✓"); } catch { toast(url); } }}>🔗 Copy link</button>}
    <a className="btn ghost small" href={`/api/invoices/${inv.id}/document`}>⬇ DOCX</a>
    <button className="btn ghost small" onClick={async () => { try { const r = await api(`/api/invoices/${inv.id}/send`, { method: "POST", body: {} }); toast(r.test_mode ? "Invoice sent (test mode — recorded, not delivered) ✓" : "Invoice sent ✓"); onDone && onDone(); } catch (e: any) { setMsg(e.message); toast(e.message); } }}>✉ Send to customer</button>
    {inv.sent_at && <span className="muted">sent {new Date(inv.sent_at).toLocaleDateString()}</span>}
    {msg && <span className="err">{msg}</span>}
  </span>);
}

function FinancesStrip({ f, openLead }: any) {
  const [drillKey, setDrillKey] = useState("");
  if (!f) return null;
  const cell = (label: string, x: any, key: string, accent?: string) => (<div key={key} role="button" tabIndex={0} title={(x?.definition || "") + " — click to see the records"} onClick={() => setDrillKey(key)} onKeyDown={e => { if (e.key === "Enter") setDrillKey(key); }} style={{ flex: "1 1 150px", minWidth: 140, cursor: "pointer", borderRadius: 10, padding: "6px 8px", margin: "-6px -8px" }} className="finCell">
    <div className="tiny muted" style={{ fontWeight: 700, letterSpacing: 0.3 }}>{label} <span style={{ color: "var(--pine, #0E5C3A)" }}>→</span></div>
    <div style={{ fontSize: 21, fontWeight: 800, color: accent || "var(--ink)" }}>{money(x?.value || 0)}</div>
    <div className="tiny muted" style={{ lineHeight: 1.35 }}>{x?.definition || ""}</div>
  </div>);
  return (<div className="card wpRise" style={{ marginTop: 12 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><b>💰 Money — kept separate, on purpose</b><span className="tiny muted">Estimates are not revenue. Every figure opens its records.</span></div>
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10 }}>
      {cell("ESTIMATED PIPELINE", f.estimated_pipeline, "estimated_pipeline")}
      {cell("PROPOSALS OUT", f.proposal_value_outstanding, "proposal_value_outstanding")}
      {cell("APPROVED", f.approved_proposal_value, "approved_proposal_value")}
      {cell("SIGNED CONTRACTS", f.signed_contract_value, "signed_contract_value", "#157347")}
      {cell("INVOICED", f.invoiced_value, "invoiced_value")}
      {cell("COLLECTED CASH", f.collected_cash, "collected_cash", "#157347")}
      {cell("RECEIVABLES OPEN", f.outstanding_receivables, "outstanding_receivables", "#b45309")}
      {cell("OVERDUE", f.overdue_receivables, "overdue_receivables", "#b91c1c")}
    </div>
    {drillKey && <MoneyDrill dkey={drillKey} close={() => setDrillKey("")} openLead={openLead} />}
  </div>);
}
function MoneyDrill({ dkey, close, openLead }: any) {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState("");
  useEffect(() => { api("/api/finances/drill/" + dkey).then(setD).catch((e: any) => setErr(e.message)); }, [dkey]);
  const openRow = (r: any) => { if (r.kind === "job" || (r.kind !== "lead" && r.job_id)) { (window as any).wpOpenJob?.(r.job_id); close(); } else if (r.lead_id) { openLead ? openLead(r.lead_id) : (window as any).wpOpenLead?.(r.lead_id); close(); } };
  return (<div className="modalWrap" style={{ zIndex: 70 }}><div className="modal" style={{ maxWidth: 620 }}>
    <div className="rowflex" style={{ justifyContent: "space-between" }}><h3 style={{ margin: 0 }}>{d ? d.title : "Loading…"}</h3><button className="btn ghost small" onClick={close}>✕</button></div>
    {err && <div className="err" style={{ marginTop: 10 }}>{err}</div>}
    {d && <><p className="muted" style={{ margin: "6px 0" }}>{d.definition}</p>
      <div className="rowflex" style={{ margin: "4px 0 8px" }}><span style={{ fontSize: 20, fontWeight: 800 }}>{money(d.total)}</span><span className="muted">across {d.count} record{d.count === 1 ? "" : "s"} — this list is the figure, record for record.</span></div>
      {d.rows.length === 0 && <p className="muted">Nothing here yet — when a record lands in this bucket, it will appear in this list.</p>}
      <div style={{ maxHeight: 380, overflow: "auto" }}>{d.rows.map((r: any, i: number) => <div key={i} className="rowflex" onClick={() => openRow(r)} style={{ padding: "8px 6px", borderTop: "1px solid #eef2f7", cursor: (r.job_id || r.lead_id) ? "pointer" : "default", alignItems: "baseline" }}>
        <span style={{ flex: 1 }}><b>{r.title}</b><br /><span className="muted" style={{ fontSize: 12.5 }}>{r.sub}</span></span>
        <b>{money(r.amount)}</b>
        {r.kind === "invoice" && r.link && <a className="btn ghost small" href={r.link.startsWith("http") ? r.link : location.origin + r.link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>👁 Invoice</a>}
        {(r.job_id || r.lead_id) && <span className="muted">→</span>}
      </div>)}</div>
      <p className="tiny muted" style={{ marginTop: 8 }}>Click a row to open the {d.rows[0]?.kind === "invoice" ? "job" : "record"} behind it.</p></>}
  </div></div>);
}
function OnboardingCard({ go }: any) {
  const [ob, setOb] = useState<any>(null); const [hide, setHide] = useState(localStorage.getItem("wp_ob_hide") === "1");
  useEffect(() => { api("/api/onboarding").then(setOb).catch(() => {}); }, []);
  if (!ob || ob.complete || hide) return null;
  const next = ob.steps.find((x: any) => !x.done);
  return (<div className="card" style={{ borderLeft: "4px solid #0b6e3f", marginBottom: 12 }}>
    <div className="rowflex" style={{ justifyContent: "space-between" }}><b>🚀 Get set up — {ob.done_count} of {ob.total} done</b><button className="btn ghost small" onClick={() => { localStorage.setItem("wp_ob_hide", "1"); setHide(true); }}>Dismiss</button></div>
    <div style={{ height: 8, background: "#e2e8f0", borderRadius: 6, margin: "8px 0" }}><div style={{ height: 8, width: Math.round(ob.done_count / ob.total * 100) + "%", background: "#0b6e3f", borderRadius: 6 }} /></div>
    {ob.steps.map((x: any) => <div key={x.key} className="rowflex" style={{ padding: "5px 0", opacity: x.done ? .65 : 1 }}><span>{x.done ? "✅" : "⬜"}</span><div style={{ flex: 1 }}><b style={{ fontSize: 13.5 }}>{x.label}</b> <span className="muted" style={{ fontSize: 12 }}>— {x.hint}</span></div>{!x.done && next && x.key === next.key && <button className="btn small" onClick={() => go({ view: x.view })}>Do it →</button>}</div>)}
    <p className="muted" style={{ fontSize: 12, margin: "6px 0 0" }}>Built around one thing: your first sent proposal. Everything else can wait.</p></div>);
}

function HomeDash({ go, openLead, m, d }: any) {
  const [home, setHome] = useState<any>(null); const [ins, setIns] = useState<any[]>([]);
  const [runOpen, setRunOpen] = useState(false); const [toasts, setToasts] = useState<any[]>([]); const [actRange, setActRange] = useState(30);
  const [calDay, setCalDay] = useState(new Date().toISOString().slice(0, 10)); const [calDone, setCalDone] = useState<Set<string>>(new Set());
  useEffect(() => { api("/api/home").then(setHome).catch(() => {}); api("/api/ai/insights").then(setIns).catch(() => {}); }, []);
  const toast = (text: string) => { const id = Date.now() + Math.random(); setToasts(t => [...t, { id, text }]); setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 5200); };
  const pipe = useCountUp(Math.round(m.pipeline_open_value || 0)); const wonM = useCountUp(Math.round(d.won_value || 0));
  if (!home) return <div className="card animIn"><p className="muted">Assembling your command center…</p></div>;
  const maxA = Math.max(1, ...home.activity_series.map((s: any) => s.count));
  const auto = home.agent.automations || {};
  const autoNames: [string, string][] = [["auto_score", "Scoring"], ["auto_assign", "Assignment"], ["auto_dedupe", "De-dupe"], ["auto_reactivate", "Reactivation"]];
  const todayStr = new Date().toISOString().slice(0, 10);
  const KINDC: Record<string, [string, string]> = { callback: ["#fef9c3", "📞"], visit: ["#fce7f3", "📍"], schedule: ["#dbeafe", "👷"], task: ["#dcfce7", "✅"], followup: ["#ede9fe", "🔁"], invoice: ["#ffedd5", "🧾"], doc: ["#fee2e2", "📄"], expiry: ["#fef3c7", "⏳"], job: ["#e0e7ff", "🛠"] };
  const week: any[] = [...Array(7)].map((_, i) => { const dt = new Date(Date.now() + i * 86400000); return { key: dt.toISOString().slice(0, 10), dow: dt.toLocaleDateString(undefined, { weekday: "narrow" }), num: dt.getDate(), has: home.upcoming.some((u: any) => u.date === dt.toISOString().slice(0, 10)) }; });
  const byDay = new Map<string, any[]>(); for (const u of home.upcoming) { if (!byDay.has(u.date)) byDay.set(u.date, []); byDay.get(u.date)!.push(u); }
  const STC: Record<string, string> = { NEW: "info", WORKING: "warn", QUALIFIED: "info", PROPOSAL: "warn", SENT: "info", FOLLOWUP: "warn", WON: "pass", LOST: "fail", NO_RESPONSE: "warn", CLOSED: "info", JUNK: "fail" };
  return (<div>
      <OnboardingCard go={go} />
    <div className="homeGrid">
      <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
        <div className="statRow">
          <div className="statCard animIn" style={{ animationDelay: "0ms", ["--glow" as any]: "#22c55e" }} onClick={() => go({ view: "leads", leads: { bucket: "proposal" } })}><div className="ic" style={{ background: "#dcfce7" }}>💵</div><div className="v">${num(pipe)}</div><div className="l">Open pipeline — qualified → sent</div></div>
          <div className="statCard animIn" style={{ animationDelay: "60ms", ["--glow" as any]: "#f59e0b" }} onClick={() => go({ view: "leads", leads: { bucket: "proposal" } })}><div className="ic" style={{ background: "#fef9c3" }}>📨</div><div className="v">{home.proposals_sent_week}<span style={{ fontSize: 14, color: "#94a3b8" }}> / {home.proposals_built_week} built</span></div><div className="l">Proposals sent this week ★ North Star{home.proposals_test_week > 0 ? ` — ${home.proposals_test_week} in test mode (not delivered)` : ""}</div></div>
          <div className="statCard animIn" style={{ animationDelay: "120ms", ["--glow" as any]: "#38bdf8" }} onClick={() => go({ view: "approvals" })}><div className="ic" style={{ background: "#dbeafe" }}>✅</div><div className="v">{m.first_pass_approval_rate !== null && m.first_pass_approval_rate !== undefined ? m.first_pass_approval_rate + "%" : "—"}</div><div className="l">First-pass approval · target 90%</div></div>
          <div className="statCard animIn" style={{ animationDelay: "180ms", ["--glow" as any]: "#e879f9" }} onClick={() => go({ view: "leads", leads: { bucket: "won" } })}><div className="ic" style={{ background: "#fce7f3" }}>🏆</div><div className="v">${num(wonM)}</div><div className="l">Won value — {num(m.won)} deals all time</div></div>
        </div>

        <FinancesStrip f={home.finances} openLead={openLead} />
    <PeriodsStrip />

                <div className="agentCard animIn" style={{ animationDelay: "120ms" }}>
          <div className="rowflex" style={{ justifyContent: "space-between" }}><b style={{ fontSize: 16 }}>🤖 Workpile Agent</b><span style={{ fontSize: 12.5, display: "flex", gap: 7, alignItems: "center" }}>{home.agent.active_count > 0 ? `🟢 Armed — ${home.agent.active_count} of 4 automations on${home.agent.runs?.[0] ? ` · last ran ${(() => { const h = Math.max(0, Math.round((Date.now() - new Date(home.agent.runs[0].created_at).getTime()) / 3600000)); return h < 1 ? "under an hour ago" : h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`; })()}` : ""}` : "⏸ Paused — all automations off"}</span></div>
          <p style={{ opacity: .85, fontSize: 13, margin: "6px 0 10px" }}>The agent works the backlog between your logins — scoring, assigning, de-duping, reactivating — inside your guardrails: nothing customer-facing sends without approval, prices only ever come from the price book. {auto.last_automation_at ? `Last run ${dt(auto.last_automation_at)}.` : "It hasn't run yet."}</p>
          <div className="rowflex" style={{ marginBottom: 10 }}>{autoNames.map(([k, l]) => <span key={k} className="tinyBadge" style={{ background: auto[k] ? "#22c55e" : "rgba(255,255,255,.18)", color: "#fff", border: 0 }}>{auto[k] ? "✓" : "○"} {l}</span>)}
            {(home.untouched_count || 0) > 0 && <button className="btn small" style={{ background: "#fde047", color: "#713f12", position: "relative", zIndex: 1, fontWeight: 700 }} onClick={async () => { const r = await api("/api/agent/triage-untouched", { method: "POST", body: {} }).catch(() => null); if (r) window.dispatchEvent(new CustomEvent("wp-agent", { detail: { executionId: r.id } })); }}>⚡ Handle {home.untouched_count} untouched — AI does the work, you approve the sends</button>}
            <button className="btn small" style={{ background: "#fff", color: "#14532d", position: "relative", zIndex: 1 }} onClick={() => setRunOpen(true)}>▶ Run agent now</button>
            <button className="btn ghost small" style={{ color: "#fff", borderColor: "rgba(255,255,255,.45)", background: "transparent", position: "relative", zIndex: 1 }} onClick={() => go({ view: "ai" })}>Open AI Assistant</button></div>
          {home.agent.runs.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 6, position: "relative", zIndex: 1 }}>{home.agent.runs.slice(0, 3).map((r: any, i: number) => <div className="agentRun" key={i}><b>{r.agent}</b> — {r.summary} <span style={{ opacity: .7 }}>· {dt(r.created_at)}</span></div>)}</div>}
          {ins.length > 0 && <div style={{ marginTop: 10, position: "relative", zIndex: 1 }}>{ins.slice(0, 2).map((i: any, k: number) => <div key={k} style={{ fontSize: 13, padding: "5px 0", borderTop: "1px solid rgba(255,255,255,.15)" }}>{i.icon} <b>{i.title}</b> — <span style={{ opacity: .85 }}>{i.detail}</span></div>)}</div>}
        </div>

        <div className="card animIn" style={{ animationDelay: "200ms" }}><h3 style={{ marginTop: 0 }}>Activity <span className="muted" style={{ fontWeight: 400, fontSize: 12.5 }}>every action the team + agent took, per day</span><span style={{ float: "right" }} className="segPills"><button className={actRange === 14 ? "on" : ""} onClick={() => setActRange(14)}>14 days</button><button className={actRange === 30 ? "on" : ""} onClick={() => setActRange(30)}>30 days</button></span></h3>
          <div className="actBars">{home.activity_series.slice(30 - actRange).map((s: any, i: number) => <div key={i} className={`ab ${s.day === todayStr ? "today" : ""}`} title={`${s.label}: ${s.count} actions`} style={{ height: `${Math.max(3, 100 * s.count / Math.max(1, ...home.activity_series.slice(30 - actRange).map((x: any) => x.count)))}%`, transitionDelay: `${i * 18}ms` }} />)}</div>
          <div className="rowflex" style={{ justifyContent: "space-between" }}><span className="muted" style={{ fontSize: 11.5 }}>{home.activity_series[30 - actRange]?.label}</span><span className="muted" style={{ fontSize: 11.5 }}>{home.activity_series[29]?.label} · today ●</span></div>
        </div>

        <div className="card animIn" style={{ animationDelay: "260ms" }}><h3 style={{ marginTop: 0 }}>Recently assigned <span className="more" onClick={() => go({ view: "leads" })}>View all →</span></h3>
          {home.recently_assigned.map((l: any, i: number) => <div className="recentRow animIn" key={l.id} style={{ animationDelay: `${i * 55}ms` }} onClick={() => openLead(l.id)}>
            <div className="avatar">{(l.contact_name || "?").split(" ").map((x: string) => x[0]).slice(0, 2).join("")}</div>
            <div style={{ flex: 1, minWidth: 0 }}><b>{l.contact_name || "—"}</b><div className="muted" style={{ fontSize: 12.5 }}>{l.service_requested} · {money(l.est_value)}{l.ai_score ? ` · AI score ${l.ai_score}` : ""}</div></div>
            <span className="muted" style={{ fontSize: 12.5 }}>{relTime(l.created_at)}<br />{l.owner_name || "Unassigned"}</span>
            <span className={`st ${STC[l.state] || "info"}`}>{l.state.replaceAll("_", " ")}</span>
          </div>)}
          {home.recently_assigned.length === 0 && <p className="muted">No leads yet — import a CSV or connect a source and the agent starts working.</p>}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="card animIn" style={{ animationDelay: "200ms" }}><h3 style={{ marginTop: 0 }}>Goal — first-pass approval <span className="seeAll" onClick={() => go({ view: "approvals" })}>Approvals ↗</span></h3>
          <GoalGauge pct={m.first_pass_approval_rate} target={90} />
          <p className="muted" style={{ textAlign: "center", fontSize: 12.5, margin: "2px 0 4px" }}>{m.first_pass_approval_rate >= 90 ? "🎉 Target beaten — the agent's drafts are landing first try." : "Proposals approved without changes ÷ decided. The agent's drafting quality drives this."}</p>
        </div>
        <div className="card animIn" style={{ animationDelay: "150ms" }}><h3 style={{ marginTop: 0 }}>📅 Calendar <span style={{ float: "right", display: "flex", gap: 4 }}><button className="btn ghost small" onClick={() => { const d = new Date(calDay + "T12:00:00"); d.setDate(d.getDate() - 7); setCalDay(d.toISOString().slice(0, 10)); }}>‹ Week</button><button className="btn ghost small" onClick={() => setCalDay(todayStr)}>Today</button><button className="btn ghost small" onClick={() => { const d = new Date(calDay + "T12:00:00"); d.setDate(d.getDate() + 7); setCalDay(d.toISOString().slice(0, 10)); }}>Week ›</button></span></h3>
          {(() => { const monday = new Date(calDay + "T12:00:00"); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7)); const days = [...Array(7)].map((_, i) => { const d = new Date(monday); d.setDate(d.getDate() + i); const key = d.toISOString().slice(0, 10); return { key, dow: d.toLocaleDateString(undefined, { weekday: "narrow" }), num: d.getDate(), n: home.upcoming.filter((u: any) => u.date === key).length }; });
            const dayItems = home.upcoming.filter((u: any) => u.date === calDay);
            const overdue = calDay === todayStr ? home.upcoming.filter((u: any) => u.date < todayStr && !calDone.has(u.task_id || "")) : [];
            const row = (u: any, i: number) => <div className="upCard" key={(u.task_id || u.kind + u.date + u.title) + i} style={{ background: (KINDC[u.kind] || ["#f1f5f9"])[0], animationDelay: `${i * 40}ms`, opacity: calDone.has(u.task_id || "") ? .45 : 1 }} onClick={() => u.lead_id && openLead(u.lead_id)}><span className="upIc">{(KINDC[u.kind] || ["", "•"])[1]}</span><span className="upMain"><b>{u.title}</b><span className="upSub">{u.sub}{u.time && u.time !== "00:00" ? ` · ${u.time}` : ""}</span></span><span className="upAct">{u.kind === "task" && u.task_id && !calDone.has(u.task_id) ? <button className="btn small upDone" onClick={async (e) => { e.stopPropagation(); await api(`/api/tasks/${u.task_id}/complete`, { method: "POST", body: {} }).catch(() => {}); setCalDone(prev => new Set(prev).add(u.task_id)); toast("Task done ✓"); }}>✓ Done</button> : (u.time && u.time !== "00:00" ? <span className="upTime">{u.time}</span> : null)}</span></div>;
            return (<>
              <div className="weekStrip">{days.map(wd => <div key={wd.key} onClick={() => setCalDay(wd.key)} style={{ cursor: "pointer" }}><div className="wd">{wd.dow}</div><div className={`wn ${wd.key === todayStr ? "today" : ""} ${wd.n ? "has" : ""}`} style={wd.key === calDay ? { outline: "2.5px solid #166534", outlineOffset: 1 } : undefined}>{wd.num}</div>{wd.n > 0 && <div style={{ fontSize: 10, textAlign: "center", color: "#64748b" }}>{wd.n} item{wd.n === 1 ? "" : "s"}</div>}</div>)}</div>
              {overdue.length > 0 && <div style={{ marginTop: 6 }}><div className="muted" style={{ fontSize: 12, fontWeight: 700, color: "#b3261e" }}>⚠ Overdue ({overdue.length})</div>{overdue.slice(0, 5).map(row)}{overdue.length > 5 && <p className="muted" style={{ fontSize: 12 }}>+{overdue.length - 5} more overdue — work them in the Queue.</p>}</div>}
              <div className="muted" style={{ fontSize: 12, fontWeight: 700, margin: "10px 0 6px" }}>{calDay === todayStr ? "Today" : new Date(calDay + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</div>
              {dayItems.map(row)}
              {dayItems.length === 0 && <p className="muted">Nothing scheduled this day — visits, crew days, tasks, follow-ups, callbacks, invoice due dates and expiries all land here.</p>}
            </>); })()}
          <button className="btn ghost small" style={{ marginTop: 4 }} onClick={() => (window as any).wpGoTab?.("planner", "calendar")}>Open full calendar →</button>
        </div>
        <div className="card animIn" style={{ animationDelay: "220ms" }}><h3 style={{ marginTop: 0 }}>Quick links</h3>
          <div className="qlRow" onClick={() => go({ view: "myday" })}>🌅 Today's plan <span style={{ marginLeft: "auto" }}>›</span></div>
          <div className="qlRow" onClick={() => (window as any).wpGoTab?.("planner", "tasks")}>🔁 Follow-ups & tasks <span style={{ marginLeft: "auto" }}>›</span></div>
          <div className="qlRow" onClick={() => go({ view: "queue" })}>⚡ Work the backlog <span style={{ marginLeft: "auto" }}>›</span></div>
          <div className="qlRow" onClick={() => go({ view: "approvals" })}>✅ Approvals inbox <span style={{ marginLeft: "auto" }}>›</span></div>
          <div className="qlRow" onClick={() => go({ view: "reports" })}>📊 Monthly target & reports <span style={{ marginLeft: "auto" }}>›</span></div>
        </div>
      </div>
    </div>
    {runOpen && <AgentRunModal close={() => setRunOpen(false)} done={(msg: string) => { setRunOpen(false); toast(msg); api("/api/home").then(setHome).catch(() => {}); }} />}
    <div className="toastBox">{toasts.map(t => <div className="toast" key={t.id}>✅ {t.text}</div>)}</div>
  </div>);
}

function AgentRunModal({ close, done }: any) {
  const [phase, setPhase] = useState(0); const [result, setResult] = useState<any>(null); const [err, setErr] = useState("");
  const stepsRef = useRef<any[]>([]);
  useEffect(() => { (async () => {
    const auto = await api("/api/ai/automations").catch(() => ({}));
    const plan: any[] = [];
    if (auto.auto_score) plan.push(["score", "🎯", "Scoring every lead", "scored", "leads scored"]);
    if (auto.auto_assign) plan.push(["assign", "👤", "Assigning unowned leads", "assigned", "leads assigned"]);
    if (auto.auto_dedupe) plan.push(["dedupe", "🧹", "Merging duplicates", "archived_duplicates", "duplicates archived"]);
    if (auto.auto_reactivate) plan.push(["reactivate", "🔁", "Reactivating stale leads", "reactivation_tasks", "follow-up tasks created"]);
    stepsRef.current = plan;
    if (!plan.length) { setErr("All four automations are off — the agent has nothing it's allowed to do. Turn them on in AI Assistant → Auto-pilot, or below."); return; }
    const r = await api("/api/ai/automations/run", { method: "POST", body: {} }).catch((e: any) => ({ error: e.message }));
    if ((r as any).error) { setErr((r as any).error); return; }
    setResult(r.result || {});
    for (let i = 0; i <= plan.length; i++) { setPhase(i); await new Promise(res => setTimeout(res, 650)); }
  })(); }, []);
  const plan = stepsRef.current;
  const summary = result ? [["scored", "scored"], ["assigned", "assigned"], ["archived_duplicates", "duplicates archived"], ["reactivation_tasks", "reactivation tasks"]].filter(([k]) => result[k] > 0).map(([k, l]) => `${result[k]} ${l}`).join(" · ") : "";
  return (<div className="modalWrap" onClick={close}><div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
    <h3 style={{ marginTop: 0 }}>🤖 Agent run</h3>
    <p className="muted" style={{ marginTop: 0 }}>Controlled autonomy: the agent executes the steps you've switched on, logs every action, and stops at your approval gates.</p>
    {err && <><div className="err">{err}</div><div className="rowflex" style={{ marginTop: 10 }}><button className="btn small" onClick={async () => { await api("/api/ai/automations", { method: "POST", body: { auto_score: true, auto_assign: true, auto_dedupe: true, auto_reactivate: true } }); done("All automations switched on — run the agent again any time"); }}>Switch all four on</button><button className="btn ghost small" onClick={close}>Close</button></div></>}
    {!err && plan.map((s: any, i: number) => <div className="stepRow" key={s[0]}>{phase > i ? <span style={{ fontSize: 17 }}>✅</span> : phase === i ? <span className="stepSpin" /> : <span style={{ opacity: .35, fontSize: 17 }}>{s[1]}</span>}<span style={{ flex: 1, opacity: phase >= i ? 1 : .45 }}>{s[2]}</span>{phase > i && result && <b>{result[s[3]] ?? 0} {s[4]}</b>}</div>)}
    {!err && result && phase > plan.length - 1 && <div style={{ marginTop: 12 }}><div className="ok">Run complete — {summary || "everything was already clean; no changes needed"}.</div><div className="rowflex" style={{ marginTop: 10 }}><button className="btn" onClick={() => done(`Agent run complete — ${summary || "no changes needed"}`)}>Done</button></div></div>}
    {!err && !result && <p className="muted">Starting…</p>}
  </div></div>);
}

function Dashboard({ go, openLead }: any) {
  const [d, setD] = useState<any>(null); const [ins, setIns] = useState<any[]>([]); const [brief, setBrief] = useState<any>(null);
  useEffect(() => { api("/api/dashboard").then(setD).catch(() => {}); api("/api/ai/insights").then(setIns).catch(() => {}); api("/api/brief").then(setBrief).catch(() => {}); }, []);
  if (!d) return <p className="muted">Loading dashboard…</p>;
  const m = d.metrics;
  const maxF = Math.max(1, ...d.funnel.map((f: any) => f.count));
  const maxS = Math.max(1, ...d.series.map((s: any) => s.created + s.won));
  const K = ({ lab, val, hint, onClick, cls }: any) => <div className="kpi" onClick={onClick}><div className="lab">{lab}</div><div className="val">{val}</div><div className="hint">{hint}</div></div>;
  return (<div>
    <h2 className="pt">Dashboard</h2><p className="sub">Every number is live and clickable — drill straight into the records behind it.</p>
    {brief && <div className="briefCard"><div style={{ flex: 1 }}><div className="briefTag">☀️ MORNING BRIEF — {dOnly(brief.generated_at)}</div><div className="briefHead">{brief.headline}</div>
      <div className="chipRow" style={{ marginTop: 10 }}>
        {brief.pending_approvals > 0 && <button className="chip on" onClick={() => go({ view: "approvals" })}>{brief.pending_approvals} approvals waiting →</button>}
        {brief.undelivered_finals > 0 && <button className="chip" onClick={() => go({ view: "handoffs" })}>{brief.undelivered_finals} finals not yet picked up →</button>}
        {brief.backlog_remaining > 0 && <button className="chip" onClick={() => go({ view: "leads", leads: { bucket: "new" } })}>{brief.backlog_remaining} in backlog →</button>}
        <button className="chip" onClick={() => go({ view: "ai" })}>🤖 AI insights →</button></div></div>
      <div className="briefSide">{(brief.stuck || []).slice(0, 3).map((t: any, i: number) => <div key={i}>⏰ {t.service_requested} — {t.state.replaceAll("_", " ").toLowerCase()}, overdue</div>)}</div></div>}
    <HomeDash go={go} openLead={openLead} m={m} d={d} />
    <DashboardPins />
    {ins.length > 0 && <div className="card"><h3>🤖 AI insights <span className="more" onClick={() => go({ view: "ai" })}>Open AI Assistant →</span></h3>{ins.slice(0, 3).map((i: any, k: number) => <div className="insight" key={k}><div className="ic">{i.icon}</div><div><b>{i.title}</b><p>{i.detail}</p></div></div>)}</div>}
    <div className="grid3">
      <div className="card funnel"><h3>Pipeline funnel <span className="more" onClick={() => go({ view: "leads" })}>Open leads →</span></h3>
        {d.funnel.map((f: any) => <div className="row" key={f.state} onClick={() => go({ view: "leads", leads: { state: f.state } })}><div className="fl">{f.state.replaceAll("_", " ")}</div><div className="bar" style={{ width: `${Math.max(2, 100 * f.count / maxF)}%` }} /><div className="fv">{num(f.count)} · {money(f.value)}</div></div>)}
      </div>
      <div className="card"><h3>Approvals waiting <span className="more" onClick={() => go({ view: "approvals" })}>Inbox →</span></h3>
        {d.approvals_pending.length === 0 && <p className="muted">Inbox zero. Nothing waiting on you.</p>}
        {d.approvals_pending.map((a: any) => <div className="feed" key={a.id}><div className="ev"><b>{a.service_requested}</b> · {money(a.est_value)}<br /><span>{a.tier} tier · submitted {dt(a.submitted_at)}</span></div></div>)}
      </div>
    </div>
    <div className="grid2">
      <div className="card"><h3>Last 14 days — new vs won</h3>
        <div className="bars">{d.series.map((s: any) => <div className="col" key={s.day}><div className="stk" style={{ height: `${Math.max(3, 100 * (s.created + s.won) / maxS)}px` }}><div className="c2" style={{ height: `${100 * s.created / Math.max(1, s.created + s.won)}%` }} /><div className="c1" style={{ height: `${100 * s.won / Math.max(1, s.created + s.won)}%` }} /></div><div className="dl">{s.day}</div></div>)}</div>
        <p className="muted" style={{ fontSize: 12 }}><span style={{ color: "#0ea5e9" }}>■</span> new leads · <span style={{ color: "#22c55e" }}>■</span> won</p>
      </div>
      <div className="card"><h3>By service <span className="more" onClick={() => go({ view: "demand" })}>Demand gap →</span></h3>
        <table><thead><tr><th>Service</th><th>Leads</th><th>Won</th><th>Value</th></tr></thead><tbody>
          {d.by_service.map((s: any) => <tr className="clickable" key={s.service} onClick={() => go({ view: "leads", leads: { service: s.service } })}><td>{s.service}</td><td>{num(s.leads)}</td><td>{num(s.won)}</td><td>{money(s.value)}</td></tr>)}
        </tbody></table>
      </div>
    </div>
    <div className="grid2">
      <div className="card"><h3>Team leaderboard</h3>
        <table><thead><tr><th>Owner</th><th>Active</th><th>Won</th><th>Lost</th></tr></thead><tbody>
          {m.by_owner.map((o: any, i: number) => <tr key={i}><td>{o.name || "Unassigned"}</td><td>{num(o.active)}</td><td>{num(o.won)}</td><td>{num(o.lost)}</td></tr>)}
        </tbody></table>
        <p className="muted" style={{ fontSize: 12.5 }}>Field-report compliance: {m.field_report_compliance_pct ?? "—"}%</p>
      </div>
      <div className="card"><h3>Recent activity</h3><div className="feed">
        {d.recent_events.map((e: any) => <div className="ev" key={e.id}><b>{e.contact_name || e.service_requested || "Lead"}</b> — {e.type.replaceAll("_", " ")}{e.to_state ? ` → ${e.to_state}` : ""}<br /><span>{dt(e.created_at)}</span></div>)}
      </div></div>
    </div>
  </div>);
}

function Leads({ initial, openLead, users, me }: any) {
  const [sel, setSel] = useState<Set<string>>(new Set()); const [bulkMsg, setBulkMsg] = useState("");
  const bulk = async (action: string, extra: any = {}) => { const r = await api("/api/leads/bulk", { method: "POST", body: { ids: [...sel], action, ...extra } }).catch((e: any) => ({ error: e.message })); if ((r as any).error) { setBulkMsg("Error: " + (r as any).error); return; } setBulkMsg(`Done: ${r.ok} updated, ${r.skipped} skipped${r.details?.length ? " — " + r.details.slice(0, 2).map((d: any) => d.reason).join("; ") : ""}`); setSel(new Set()); setTickFix(t => t + 1); };
  const [syncOpen, setSyncOpen] = useState(false);
  const [mode, setMode] = useState<"table" | "board" | "dupes">(initial?.mode === "dupes" ? "dupes" : "table");
  useEffect(() => { if (initial?.mode === "dupes") setMode("dupes"); }, [initial]);
  const [f, setF] = useState<any>(initial || {});
  const [data, setData] = useState<any>({ items: [], total: 0, page: 1, pages: 1 });
  const [board, setBoard] = useState<Record<string, any>>({});
  const [tickFix, setTickFix] = useState(0);
  const load = () => { const qs = new URLSearchParams({ paged: "1", page: String(f.page || 1), page_size: "50", sort: f.sort || "recent" }); for (const k of ["state", "bucket", "q", "service", "owner_id", "overdue", "min_value", "unassigned"]) if (f[k]) qs.set(k, f[k]); api("/api/leads?" + qs).then(setData).catch(() => {}); };
  useEffect(load, [JSON.stringify(f), tickFix]);
  const [bstats, setBstats] = useState<any>(null); const [dragId, setDragId] = useState("");
  const loadBoard = () => { const o: any = {}; Promise.all(BOARD_STAGES.map(([st]) => api(st === "CLOSED" ? `/api/leads?paged=1&bucket=closed&page=1&page_size=25` : `/api/leads?paged=1&state=${st}&page=1&page_size=25`).then(r => { o[st] = r; }))).then(() => setBoard({ ...o })); api("/api/board-stats").then(setBstats).catch(() => {}); };
  useEffect(() => { if (mode === "board") loadBoard(); }, [mode, tickFix]);
  const dropStage = async (st: string) => { if (!dragId || st === "CLOSED") return; try { await api(`/api/leads/${dragId}/stage`, { method: "POST", body: { to: st } }); } catch (e: any) { if (e.message === "won_needs_confirmation" && confirm("No signed proposal on this lead. Mark WON as a verbal/legacy win and create the job?")) { await api(`/api/leads/${dragId}/stage`, { method: "POST", body: { to: st, confirm_no_proposal: true } }).catch(() => {}); } else if (e.message === "reason_required") { const r = prompt("Reason for closing (price, timing, competitor, unresponsive…):"); if (r) await api(`/api/leads/${dragId}/stage`, { method: "POST", body: { to: "LOST", lost_reason: r } }).catch(() => {}); } }
    setDragId(""); loadBoard(); setTickFix(t => t + 1); };
  const Pager = () => <div className="pager"><span>{num(data.total)} leads · page {data.page} of {num(data.pages)}</span><button className="btn ghost small" disabled={data.page <= 1} onClick={() => setF({ ...f, page: data.page - 1 })}>← Prev</button><button className="btn ghost small" disabled={data.page >= data.pages} onClick={() => setF({ ...f, page: data.page + 1 })}>Next →</button></div>;
  return (<div>
    <h2 className="pt">Leads <button className="btn" style={{ float: "right" }} onClick={() => setSyncOpen(true)}>⇅ Sync leads</button></h2><p className="sub">Search, filter, sort — built for thousands of records. Click any row to open the full record.</p>
    {syncOpen && <SyncModal close={() => setSyncOpen(false)} done={() => setTickFix(t => t + 1)} />}
    <div className="rowflex">
      <div style={{ flex: 1, minWidth: 220 }}><input type="search" placeholder="Search name, phone, email, service, notes…" value={f.q || ""} onChange={e => setF({ ...f, q: e.target.value, page: 1 })} /></div>
      <select style={{ width: 180 }} value={f.sort || "recent"} onChange={e => setF({ ...f, sort: e.target.value })}><option value="recent">Newest first</option><option value="value">Highest value</option></select>
      <select style={{ width: 190 }} value={f.owner_id || ""} onChange={e => setF({ ...f, owner_id: e.target.value, page: 1 })}><option value="">All owners</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
      <div className="tabs" style={{ border: 0, margin: 0 }}><button className={mode === "table" ? "on" : ""} onClick={() => setMode("table")}>Table</button><button className={mode === "board" ? "on" : ""} onClick={() => setMode("board")}>Board</button><button className={mode === "dupes" ? "on" : ""} onClick={() => setMode("dupes")}>Duplicates</button></div>
    </div>
    <div className="chips">
      <span className="muted" style={{ alignSelf: "center", fontWeight: 700, fontSize: 12 }}>SAVED VIEWS:</span>
      <button className="chip" onClick={() => setF({ page: 1 })}>All leads</button>
      <button className="chip" onClick={() => setF({ page: 1, owner_id: me?.id })}>My leads</button>
      <button className="chip" onClick={() => setF({ page: 1, overdue: "1" })}>⏰ Overdue next steps</button>
      <button className="chip" onClick={() => setF({ page: 1, min_value: "10000", sort: "value" })}>💰 High value $10k+</button>
      <button className="chip" onClick={() => setF({ page: 1, unassigned: "1" })}>Unassigned</button>
    </div>
    {sel.size > 0 && <div className="ok" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><b>{sel.size} selected</b>
      <select id="bulkOwner" style={{ width: 170 }} defaultValue=""><option value="">Assign to…</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
      <button className="btn small" onClick={() => { const v = (document.getElementById("bulkOwner") as HTMLSelectElement).value; if (v) bulk("assign", { owner_id: v }); }}>Assign</button>
      <button className="btn small" onClick={() => bulk("advance")}>Advance stage →</button>
      <button className="btn small ghost" onClick={() => bulk("snooze", { days: 7 })}>Snooze 7 days</button>
      <button className="btn small danger" onClick={() => bulk("archive_junk")}>Archive as junk</button>
      <button className="btn small ghost" onClick={() => setSel(new Set())}>Clear</button>{bulkMsg && <span>{bulkMsg}</span>}</div>}
    {bulkMsg && sel.size === 0 && <p className="muted">{bulkMsg}</p>}
    <div className="chips">
      <button className={`chip ${!f.bucket && !f.state ? "on" : ""}`} onClick={() => setF({ ...f, bucket: "", state: "", page: 1 })}>All</button>
      {BUCKETS.map(([b, lab]) => <button key={b} className={`chip ${f.bucket === b ? "on" : ""}`} onClick={() => setF({ ...f, bucket: b, state: "", page: 1 })}>{lab}</button>)}
      <select style={{ width: 200 }} value={f.state || ""} onChange={e => setF({ ...f, state: e.target.value, bucket: "", page: 1 })}><option value="">Any exact state…</option>{STATES.map(s => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</select>
      {f.service && <button className="chip on" onClick={() => setF({ ...f, service: "" })}>Service: {f.service} ✕</button>}
    </div>
    {mode === "dupes" ? <DuplicatesView embedded /> : mode === "table" ? (<div className="card" style={{ padding: 6 }}><table><thead><tr><th style={{ width: 30 }}><input type="checkbox" style={{ width: "auto" }} checked={data.items.length > 0 && data.items.every((l: any) => sel.has(l.id))} onChange={e => setSel(e.target.checked ? new Set(data.items.map((l: any) => l.id)) : new Set())} /></th><th>Contact</th><th>Service</th><th>AI Score</th><th>State</th><th>Value</th><th>Owner</th><th>Next step</th><th>Created</th></tr></thead><tbody>
      {data.items.map((l: any) => <tr className="clickable" key={l.id} onClick={() => openLead(l.id)}><td onClick={e => e.stopPropagation()}><input type="checkbox" style={{ width: "auto" }} checked={sel.has(l.id)} onChange={() => { const n = new Set(sel); n.has(l.id) ? n.delete(l.id) : n.add(l.id); setSel(n); }} /></td><td><b>{l.contact_name}</b><br /><span className="muted">{l.contact_phone || l.contact_email || ""}</span></td><td>{l.service_requested}</td><td>{l.ai_score !== null && l.ai_score !== undefined ? <span className={`score ${JSON.parse(l.ai_flags || "{}").temperature || "cold"}`}>{l.ai_score}</span> : <span className="muted">—</span>}</td><td onClick={e => e.stopPropagation()}><select value={l.state} style={{ width: 118, padding: "3px 5px", fontSize: 12.5 }} onChange={async e => { const to = e.target.value; try { await api(`/api/leads/${l.id}/stage`, { method: "POST", body: { to } }); setData({ ...data, items: data.items.map((x: any) => x.id === l.id ? { ...x, state: to } : x) }); } catch (err: any) { alert(err.message === "won_needs_confirmation" || err.message === "reason_required" ? "That close needs the record — click the row to finish it with a reason/confirmation." : err.message); } }}>{STATES.map(st => <option key={st} value={st}>{st.replaceAll("_", " ")}</option>)}</select></td><td>{money(l.est_value)}</td><td onClick={e => e.stopPropagation()}><select value={l.owner_id || ""} style={{ width: 130, padding: "3px 5px", fontSize: 12.5 }} onChange={async e => { await api(`/api/leads/${l.id}`, { method: "PATCH", body: { owner_id: e.target.value || null } }); setData({ ...data, items: data.items.map((x: any) => x.id === l.id ? { ...x, owner_id: e.target.value, owner_name: users.find((u: any) => u.id === e.target.value)?.name } : x) }); }}><option value="">Unassigned</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></td><td>{l.next_action || "—"}<br /><span className="muted">{dOnly(l.next_action_due_at)}</span></td><td>{dOnly(l.created_at)}</td></tr>)}
      {data.items.length === 0 && <tr><td colSpan={7} className="muted">No leads match these filters.</td></tr>}
    </tbody></table><Pager /></div>) : (
      <div className="kanban">{BOARD_STAGES.map(([st, lab]) => { const bs = bstats?.stages?.[st]; return <div className="kcol" key={st} onDragOver={e => e.preventDefault()} onDrop={() => dropStage(st)} style={st === "CLOSED" ? { opacity: 0.85 } : {}}><h4>{lab}<span>{num(board[st]?.total ?? 0)}</span></h4>
        {bs && st !== "CLOSED" && <p className="muted" style={{ fontSize: 11.5, margin: "0 0 6px" }}>{money(bs.value)} · median {bs.median_age_days}d{bs.rotting ? ` · ⚠ ${bs.rotting} rotting` : ""}</p>}
        {(board[st]?.items || []).map((l: any) => <div className="kcard" key={l.id} draggable onDragStart={() => setDragId(l.id)} onClick={() => openLead(l.id)} style={l.hold_flag ? { borderLeft: "4px solid #b45309" } : {}}><b>{l.service_requested}</b><span className="m">{l.contact_name} · {money(l.est_value)}<br />{l.hold_flag ? "⏸ on hold · " : ""}next {dOnly(l.next_action_due_at)}{!l.next_action_due_at ? " · ⚠ no next step" : ""}</span></div>)}
        {(board[st]?.total || 0) > 25 && <p className="muted" style={{ fontSize: 12 }}>+ {num(board[st].total - 25)} more — use Table view to page through all</p>}
      </div>; })}</div>)}
    {mode === "board" && <p className="muted" style={{ fontSize: 12.5 }}>Drag cards between stages — backward, forward, skip: all allowed. Dropping on Won asks for confirmation when there's no signed proposal; Closed is display-only (close from the record, with a reason).</p>}
  </div>);
}


function MessagesPanel({ lead }: any) {
  const [msgs, setMsgs] = useState<any[]>([]); const [ch, setCh] = useState("email"); const [subject, setSubject] = useState(""); const [body, setBody] = useState(""); const [note, setNote] = useState("");
  const [fups, setFups] = useState<any[]>([]);
  const loadF = () => { api(`/api/leads/${lead.id}/followups`).then(setFups).catch(() => {}); };
  useEffect(loadF, []);
  const load = () => { api(`/api/leads/${lead.id}/messages`).then(setMsgs).catch(() => {}); };
  useEffect(load, []);
  const [att, setAtt] = useState<any[]>([]);
  const send = async () => { const r = await api(`/api/leads/${lead.id}/message`, { method: "POST", body: { channel: ch, subject, body, attachments: ch === "email" ? att.map((x: any) => ({ kind: x.kind, id: x.id })) : [] } }).catch((e: any) => ({ error: e.message })); if (r.error) { setNote("Not sent: " + r.error); return; } setNote(`Queued via ${ch} → status: ${r.status}${r.status === "test_mode" ? " (test mode — recorded in the outbox, not actually sent until provider keys are set)" : ""}`); setBody(""); setSubject(""); setAtt([]); load(); };
  const activeFup = fups.find((f: any) => f.status === "active");
  return <div className="card"><h3 style={{ marginTop: 0 }}>Messages to {lead.contact_name || "customer"}</h3>
    {activeFup && <div className="ok" style={{ marginBottom: 10 }}>🔁 Automatic follow-ups running — step {(activeFup.step_idx || 0) + 1}, next nudge {dt(activeFup.next_due_at)}. Stops on signature or final outcome. <button className="btn ghost small" onClick={async () => { await api(`/api/leads/${lead.id}/followups/stop`, { method: "POST", body: {} }); loadF(); }}>Stop sequence</button></div>}
    <div className="chipRow"><button className={`chip ${ch === "email" ? "on" : ""}`} onClick={() => setCh("email")}>✉ Email {lead.contact_email || "(none on file)"}</button><button className={`chip ${ch === "sms" ? "on" : ""}`} onClick={() => setCh("sms")}>💬 SMS {lead.contact_phone || "(none)"}{lead.consent_contact_ok ? "" : " · no consent"}</button></div>
    {ch === "email" && <input placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} style={{ marginBottom: 8 }} />}
    <textarea placeholder={ch === "sms" ? "Text message…" : "Message…"} value={body} onChange={e => setBody(e.target.value)} rows={4} style={{ width: "100%" }} />
    {ch === "email" && <AttachPicker leadId={lead.id} value={att} onChange={setAtt} />}
    <div className="rowflex" style={{ marginTop: 8 }}><button className="btn" disabled={!body.trim()} onClick={send}>Send {ch === "sms" ? "text" : "email"}{att.length && ch === "email" ? ` (${att.length} 📎)` : ""}</button><EnhanceBtn text={body} onText={setBody} purpose="customer message" />{note && <span className="muted">{note}</span>}</div>
    <h4 style={{ marginBottom: 6 }}>History</h4>
    {msgs.length === 0 && <p className="muted">Nothing sent yet.</p>}
    {msgs.map((m: any) => <p key={m.id} style={{ margin: "6px 0", borderBottom: "1px solid #eef2f7", paddingBottom: 6, ...(m.direction === "in" ? { background: "#f0f9ff", borderRadius: 8, padding: 8 } : {}) }}><b>{m.direction === "in" ? "↩ Customer reply" : m.channel === "sms" ? "💬" : "✉"} {m.direction === "in" ? "" : m.to_addr}</b> · <span className="tinyBadge">{m.status}</span> <span className="muted">{dt(m.created_at)}</span>{m.subject ? <><br /><b>{m.subject}</b></> : ""}<br /><span className="muted">{m.body.slice(0, 220)}</span></p>)}
  </div>;
}

function CrewTime({ lead, users, reloadLead }: any) {
  const [lab, setLab] = useState<any>(null); const [msg, setMsg] = useState("");
  const [form, setForm] = useState<any>({ worker_name: "", entry_date: new Date().toISOString().slice(0, 10), hours: "", note: "" });
  const [addUser, setAddUser] = useState(""); const [roster, setRoster] = useState<any[]>([]);
  useEffect(() => { api("/api/workers").then(setRoster).catch(() => {}); }, []);
  const load = () => { api("/api/leads/" + lead.id + "/labor").then(setLab).catch(() => {}); };
  useEffect(load, [lead.id]);
  if (!lab) return <p className="muted">Loading crew & time…</p>;
  const sector = lead.sector || "private";
  const setLeadField = async (patch: any, ok: string) => { await api("/api/leads/" + lead.id, { method: "PATCH", body: patch }); setMsg(ok); reloadLead && reloadLead(); };
  const logTime = async () => { if (!form.worker_name.trim() || !(Number(form.hours) > 0)) return setMsg("Type a worker name and hours first — a name is all a worker needs, no account required."); const r = await offlinePost(`/api/leads/${lead.id}/time`, { worker_name: form.worker_name.trim(), entry_date: form.entry_date, hours: Number(form.hours), note: form.note }, "time entry"); if ((r as any).__offline) { setMsg("📴 No signal — time saved on this device and queued to sync when you are back."); setForm({ ...form, hours: "", note: "" }); return; } setMsg(r.rated ? `Logged ${r.entry.hours}h for ${r.worker.name} at ${money(r.entry.rate)}/hr (${r.entry.class_name}, ${sector} rate) ✓` : `Logged for ${r.worker.name} — but they have NO rate class, so it costed $0. Set their class in Settings → Workers.`); setForm({ ...form, hours: "", note: "" }); load(); };
  const crewIds = new Set(lab.crew.map((c: any) => c.worker_id || c.user_id));
  const margin = lead.est_value > 0 ? Math.round((lab.cost / lead.est_value) * 100) : null;
  return (<div>
    <div className="grid2">
      <div className="card" style={{ margin: 0 }}><h4 style={{ marginTop: 0 }}>Project setup</h4>
        <label className="f">Sector — decides which rate column applies</label>
        <select value={sector} onChange={e => setLeadField({ sector: e.target.value }, "Sector saved ✓")}><option value="private">Private — standard rates</option><option value="government">Government — prevailing-wage rates</option></select>
        <label className="f">Project manager</label>
        <select value={lead.pm_id || ""} onChange={e => setLeadField({ pm_id: e.target.value || null }, "Project manager saved ✓")}><option value="">— Unassigned —</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}</select>
        <p className="muted">The PM owns this job day-to-day; the crew below is who actually works (and gets costed) on it.</p></div>
      <div className="card" style={{ margin: 0 }}><h4 style={{ marginTop: 0 }}>Labor on this job</h4>
        <div className="kpis" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          <div className="kpi"><div className="lab">Hours</div><div className="val">{lab.hours}</div><div className="hint">logged to date</div></div>
          <div className="kpi"><div className="lab">Labor cost</div><div className="val">{money(lab.cost)}</div><div className="hint">{margin !== null ? `${margin}% of ${money(lead.est_value)} job value` : "costed at logged rates"}</div></div>
          <div className="kpi"><div className="lab">Crew</div><div className="val">{lab.crew.length}</div><div className="hint">assigned workers</div></div>
        </div>
        {lab.unrated_hours > 0 && <p className="st fail" style={{ display: "inline-block" }}>⚠ {lab.unrated_hours}h logged with no rate class — costed $0. Fix in Settings → Labor & Rates.</p>}
      </div>
    </div>
    {msg && <div className="ok" style={{ marginTop: 10 }}>{msg}</div>}
    <h4>Crew</h4>
    <div className="chipRow">{lab.crew.map((c: any) => <span key={c.id} className="chip on">{c.name} · {c.class_name || "no class"}<button className="btn ghost small" style={{ marginLeft: 6, padding: "0 6px" }} onClick={async () => { const r = await api(`/api/leads/${lead.id}/crew/${c.worker_id || c.user_id}`, { method: "DELETE" }); setLab(r); }}>✕</button></span>)}{lab.crew.length === 0 && <span className="muted">No crew yet — type a name below, or just log time and they're added automatically.</span>}</div>
    <div className="rowflex" style={{ marginTop: 8 }}><input list="rosterNames" placeholder="Add a worker by name…" value={addUser} onChange={e => setAddUser(e.target.value)} style={{ minWidth: 220 }} /><button className="btn ghost small" disabled={!addUser.trim()} onClick={async () => { const r = await api(`/api/leads/${lead.id}/crew`, { method: "POST", body: { worker_name: addUser.trim() } }); setLab(r); setAddUser(""); }}>Add to crew</button><span className="muted">Workers are a roster — names only, no logins, no seats used.</span></div>
    <h4>Log time against this job</h4>
    <div className="rowflex">
      <input list="rosterNames" placeholder="Worker name — type a new one to add them" value={form.worker_name} onChange={e => setForm({ ...form, worker_name: e.target.value })} style={{ minWidth: 240 }} /><datalist id="rosterNames">{roster.filter((w: any) => w.active).map((w: any) => <option key={w.id} value={w.name}>{w.class_name || "no class"}{w.linked_user_id ? " · team" : ""}</option>)}</datalist>
      <input type="date" value={form.entry_date} onChange={e => setForm({ ...form, entry_date: e.target.value })} />
      <input type="number" min="0" step="0.25" placeholder="Hours" style={{ width: 90 }} value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })} />
      <input placeholder="Note (phase, task…)" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} style={{ flex: 1 }} />
      <button className="btn small" onClick={logTime}>Log time</button>
    </div>
    <table style={{ marginTop: 10 }}><thead><tr><th>Date</th><th>Worker</th><th>Class</th><th>Hours</th><th>Rate</th><th>Cost</th><th>Note</th><th></th></tr></thead><tbody>
      {lab.entries.map((e: any) => <tr key={e.id}><td>{e.entry_date}</td><td>{e.worker}</td><td>{e.class_name || <span className="st fail">unrated</span>}</td><td>{e.hours}</td><td>{e.rate > 0 ? money(e.rate) : "—"}</td><td><b>{money(e.amount)}</b></td><td className="muted">{e.note}</td><td><button className="btn ghost small" onClick={async () => { const r = await api("/api/time-entries/" + e.id, { method: "DELETE" }); setLab(r); }}>✕</button></td></tr>)}
      {lab.entries.length === 0 && <tr><td colSpan={8} className="muted">No time logged yet. Every entry snapshots the worker's {sector} rate, so the job's true labor cost is always known — and later rate changes never rewrite history.</td></tr>}
    </tbody></table>
  </div>);
}

function LeadDetail({ id, users, priceBook, close, refresh, openJob, openApprovals }: any) {
  const [d, setD] = useState<any>(null); const [edit, setEdit] = useState<any>(null); const [msg, setMsg] = useState("");
  const [act, setAct] = useState<any>({ type: "call", body: "", outcome: "" }); const [sug, setSug] = useState<any>(null);
  useEffect(() => { api("/api/ai/suggest/" + id).then(setSug).catch(() => {}); }, [id, d?.lead?.state]);
  const [items, setItems] = useState<any[]>([]); const [check, setCheck] = useState<any>(null); const [tab, setTab] = useState("details"); const [overrideReason, setOverrideReason] = useState("");
  const [finalPick, setFinalPick] = useState<any>(null); // {to, reason, confirm}
  const [validDays, setValidDays] = useState(30); const [useOpts, setUseOpts] = useState(false); const [optB, setOptB] = useState<any[]>([]); const [optC, setOptC] = useState<any[]>([]);
  const [docTpls, setDocTpls] = useState<any[]>([]); const [docTpl, setDocTpl] = useState(""); const [tplTouched, setTplTouched] = useState(false);
  useEffect(() => { api("/api/doc-templates").then((l: any[]) => setDocTpls(l)).catch(() => {}); }, []);
  // Smart picker (v33): preselect the template mapped to this lead's service;
  // the workspace default otherwise. A manual change is never overridden.
  useEffect(() => { if (tplTouched || !docTpls.length) return; const norm = (s: any) => String(s || "").toLowerCase().trim().replace(/\s+/g, " "); const svc = norm(d?.lead?.service_requested); const pick = (svc && docTpls.find((t: any) => t.applies_to && norm(t.applies_to) === svc)) || docTpls.find((t: any) => t.is_default) || docTpls[0]; if (pick) setDocTpl(pick.id); }, [docTpls, d?.lead?.service_requested, tplTouched]);
  const load = () => { api("/api/leads/" + id).then(r => { setD(r); setEdit({ ...r.lead }); }).catch(e => setMsg(e.message)); };
  useEffect(load, [id]);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") close(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, []);
  if (!d) return <div className="modalWrap"><div className="modal">Loading… {msg}</div></div>;
  const l = d.lead;
  const PATH = ["NEW", "WORKING", "QUALIFIED", "PROPOSAL", "SENT", "FOLLOWUP", "WON"];
  const pathIdx = PATH.indexOf(l.state);
  const save = async () => { try { await api("/api/leads/" + id, { method: "PATCH", body: { service_requested: edit.service_requested, est_value: Number(edit.est_value) || 0, urgency: edit.urgency, owner_id: edit.owner_id, pm_id: edit.pm_id || null, approver_id: edit.approver_id || null, next_action: edit.next_action, notes: edit.notes, location: edit.location, contact: { name: edit.contact_name, phone: edit.contact_phone, email: edit.contact_email } } }); setMsg("Saved ✓"); load(); refresh && refresh(); } catch (e: any) { setMsg(e.message); } };
  const transit = async (to: string, extra: any = {}) => { try { await api(`/api/leads/${id}/transition`, { method: "POST", body: { to_state: to, ...extra } }); setMsg("Moved ✓"); load(); refresh && refresh(); } catch (e: any) { setMsg(e.message); } };
  const stageTo = async (to: string, extra: any = {}) => { try { await api(`/api/leads/${id}/stage`, { method: "POST", body: { to, ...extra } }); setMsg(`Moved to ${to.replaceAll("_", " ")} ✓`); toast(`Moved to ${to.replaceAll("_", " ")} ✓`); setFinalPick(null); load(); refresh && refresh(); } catch (e: any) { if (e.message === "reason_required") { setFinalPick({ to, reason: "", confirm: false }); setMsg(`${to.replaceAll("_", " ")} needs a reason — pick one below.`); } else if (e.message === "won_needs_confirmation") { setFinalPick({ to: "WON", reason: "", confirm: false }); setMsg("No signed proposal on this lead — confirm below if this is a verbal/legacy win."); } else setMsg(e.message); } };
  const applyFinal = async () => { if (!finalPick) return; const extra: any = {}; if (finalPick.reason) extra.lost_reason = finalPick.reason; if (finalPick.to === "WON" && finalPick.confirm) extra.confirm_no_proposal = true; await stageTo(finalPick.to, extra); };
  const buildProposal = async () => { try { const clean = items.filter(i => i.price_book_item_id); if (!clean.length) return setMsg("Add at least one price-book line item"); const body: any = { line_items: clean.map(i => ({ price_book_item_id: i.price_book_item_id, qty: Number(i.qty) || 1, unit_price: i.unit_price !== undefined && i.unit_price !== "" ? Number(i.unit_price) : undefined, template_id: docTpl || undefined, override_reason: overrideReason || undefined })), valid_days: validDays || undefined, override_reason: overrideReason || undefined };
    if (useOpts) { const mk = (arr: any[]) => arr.filter(i => i.price_book_item_id).map(i => ({ price_book_item_id: i.price_book_item_id, qty: Number(i.qty) || 1 })); const b2 = mk(optB), c2 = mk(optC); if (!b2.length && !c2.length) return setMsg("Options need at least one priced option with line items"); body.options = [{ name: "Essential", line_items: body.line_items }, ...(b2.length ? [{ name: "Recommended", line_items: b2 }] : []), ...(c2.length ? [{ name: "Complete", line_items: c2 }] : [])]; }
    await api(`/api/leads/${id}/proposals`, { method: "POST", body }); setMsg(useOpts ? "Proposal drafted with options ✓ — the customer picks one on the sign page" : "Proposal drafted from price book ✓"); setItems([]); setOptB([]); setOptC([]); load(); } catch (e: any) { setMsg(e.message); } };
  const optEditor = (arr: any[], setArr: any, label: string) => <div style={{ border: "1px dashed #cbd5e1", borderRadius: 8, padding: 8, marginTop: 6 }}><b style={{ fontSize: 13 }}>{label}</b>{arr.map((it: any, i: number) => <div className="rowflex" key={i} style={{ marginTop: 4 }}><select style={{ flex: 2 }} value={it.price_book_item_id || ""} onChange={e => { const n = [...arr]; n[i] = { ...n[i], price_book_item_id: e.target.value }; setArr(n); }}><option value="">Choose item…</option>{priceBook.map((pb: any) => <option key={pb.id} value={pb.id}>{pb.name} — {money(pb.standard_price)}</option>)}</select><input style={{ width: 60 }} type="number" value={it.qty || 1} onChange={e => { const n = [...arr]; n[i] = { ...n[i], qty: e.target.value }; setArr(n); }} /><button className="btn ghost small" onClick={() => setArr(arr.filter((_: any, x: number) => x !== i))}>✕</button></div>)}<button className="btn ghost small" style={{ marginTop: 4 }} onClick={() => setArr([...arr, { qty: 1 }])}>+ Line</button></div>;
  return (<div className="modalWrap"><div className="modal">
    <div className="rowflex" style={{ justifyContent: "space-between" }}><h3 style={{ margin: 0 }}>{l.service_requested} — {l.contact_name}</h3><button className="btn ghost small" onClick={close}>✕ Close</button></div>
    <p className="muted" style={{ margin: "6px 0" }}>{l.contact_phone || ""} {l.contact_email ? "· " + l.contact_email : ""} · {l.location || ""} · created {dt(l.created_at)}</p>
    <div className="rowflex"><Badge s={l.state} /><b>{money(l.est_value)}</b><span className="muted">Owner: {l.owner_name || "—"} · PM: {l.pm_id ? "assigned" : "none"} · Next: {l.next_action || "—"} ({dOnly(l.next_action_due_at)})</span>
      <button className="btn ghost small" title="Favorite" onClick={async () => { await api("/api/favorites", { method: "POST", body: { entity_type: "lead", entity_id: id } }); setMsg("Favorite toggled ⭐"); }}>⭐</button>
      {!l.converted_at && <button className="btn ghost small" onClick={async () => { const r = await api(`/api/leads/${id}/convert`, { method: "POST", body: {} }); setMsg(`Converted ✓ — customer: ${r.account?.name || ""}`); load(); }}>⇄ Convert to customer</button>}
      {l.converted_at && <span className="tinyBadge" style={{ background: "#dcfce7", color: "#166534" }}>✓ Converted customer</span>}</div>
    {pathIdx >= 0 ? <div className="path">{PATH.map((st, i) => <div key={st} className={`stage ${i < pathIdx ? "done" : i === pathIdx ? "cur" : ""}`} title={st} onClick={() => { if (st === l.state) return; if (st === "WON") setFinalPick({ to: "WON", reason: "", confirm: false }); else stageTo(st); }}>{st.replaceAll("_", " ")}</div>)}</div>
      : <div className="pathFinal" style={{ background: "#fee2e2", color: "#991b1b" }}>Closed: {l.state.replaceAll("_", " ")}{l.lost_reason ? " · " + l.lost_reason : ""} <button className="btn small" style={{ marginLeft: 10 }} onClick={async () => { await api(`/api/leads/${id}/reopen`, { method: "POST", body: {} }); setMsg("Reopened ✓ — the outcome record was superseded, not deleted"); load(); refresh && refresh(); }}>↩ Reopen this lead</button></div>}
    <p className="muted" style={{ fontSize: 12, margin: "2px 0 6px" }}>Stages move freely — forward, back, skip. Nothing here is a dead end; every move is on the timeline. {l.hold_flag ? <span className="st fail">⏸ On hold: {l.hold_reason || ""}{l.hold_until ? " until " + dOnly(l.hold_until) : ""} <button className="btn ghost small" onClick={async () => { await api(`/api/leads/${id}/hold`, { method: "POST", body: { clear: true } }); load(); }}>Clear hold</button></span> : <button className="btn ghost small" onClick={async () => { const reason = prompt("Hold reason (e.g. waiting on site access)"); if (reason === null) return; const until = prompt("Wake date (YYYY-MM-DD, blank = none)") || undefined; await api(`/api/leads/${id}/hold`, { method: "POST", body: { reason, until } }); load(); }}>⏸ Put on hold</button>}</p>
    {finalPick && <div className="card" style={{ margin: "8px 0", borderLeft: "4px solid #b45309" }}><b>Close as {finalPick.to.replaceAll("_", " ")}</b>
      {(finalPick.to === "LOST" || finalPick.to === "NO_RESPONSE") && <div style={{ marginTop: 8 }}><label className="f">Reason — this is what the loss data learns from</label><select value={finalPick.reason} onChange={e => setFinalPick({ ...finalPick, reason: e.target.value })}><option value="">Pick a reason…</option>{["price", "timing", "competitor", "no_budget", "unresponsive", "went_diy", "not_a_fit", "other"].map(r => <option key={r} value={r}>{r.replaceAll("_", " ")}</option>)}</select></div>}
      {finalPick.to === "WON" && <label className="check" style={{ marginTop: 8 }}><input type="checkbox" style={{ width: "auto" }} checked={finalPick.confirm} onChange={e => setFinalPick({ ...finalPick, confirm: e.target.checked })} /><span>No signed proposal — this is a verbal / legacy win, create the job anyway</span></label>}
      <div className="rowflex" style={{ marginTop: 10 }}><button className="btn small" disabled={(finalPick.to === "LOST" || finalPick.to === "NO_RESPONSE") && !finalPick.reason} onClick={applyFinal}>Confirm — close as {finalPick.to.replaceAll("_", " ")}</button><button className="btn ghost small" onClick={() => setFinalPick(null)}>Cancel</button></div></div>}
    {msg && <div className={msg.includes("✓") ? "ok" : "err"}>{msg}</div>}
    {sug && <div className="card" style={{ margin: "10px 0", padding: "10px 14px", display: "flex", gap: 12, alignItems: "center", background: "linear-gradient(90deg,#f0fdf4,#ffffff)" }}><span style={{ fontSize: 20 }}>{sug.temperature === "hot" ? "🔥" : sug.temperature === "warm" ? "🌤️" : "❄️"}</span><div style={{ flex: 1 }}><b>AI · {sug.score}/100 ({sug.temperature}) — {sug.suggestion.label}</b><br /><span className="muted">{sug.suggestion.detail}</span>{(sug.flags || []).length > 0 && <span className="muted"> · flags: {sug.flags.join(", ").replaceAll("_", " ")}</span>}</div>
      {sug.suggestion.kind === "nudge" && <button className="btn small" onClick={async () => { const r = await api("/api/ai/nudge", { method: "POST", body: { lead_id: id } }); setMsg(`Nudge sent by ${r.channel} (${String(r.status).replaceAll("_", " ")}) ✓`); }}>Nudge now</button>}
      {sug.suggestion.kind === "fix_step" && <button className="btn small" onClick={async () => { await api("/api/leads/" + id, { method: "PATCH", body: { next_action: "Follow up", next_action_due_at: new Date(Date.now() + 86400000).toISOString() } }); setMsg("Next step set for tomorrow ✓"); load(); }}>Set for tomorrow</button>}
    </div>}
    {d.next_step && d.next_step.kind !== "closed" && <div className="nextbar"><div style={{ flex: 1 }}><b>▶ Next step: {d.next_step.label}</b><br /><span style={{ opacity: .85, fontSize: 12.5 }}>{d.next_step.detail}</span></div>
      {(() => { const k = d.next_step.kind; const goTab = (t: string, label: string) => <button className="btn small" style={{ background: "#fff", color: "#14532d" }} onClick={() => setTab(t)}>{label}</button>;
        const act = async (fn: () => Promise<any>, ok: string) => { try { await fn(); toast(ok); load(); } catch (e: any) { setMsg(e.message); } };
        if (k === "call") return <span style={{ display: "inline-flex", gap: 6 }}><button className="btn small" style={{ background: "#fff", color: "#14532d" }} onClick={() => act(() => api(`/api/leads/${id}/contact`, { method: "POST", body: { type: "call", body: "First contact call — logged from Next step", outcome: "contacted" } }), "Call logged — first contact recorded ✓")}>📞 Log the call</button>{goTab("messages", "Message instead →")}</span>;
        if (k === "nudge") return <button className="btn small" style={{ background: "#fff", color: "#14532d" }} onClick={() => act(async () => { const r = await api("/api/ai/nudge", { method: "POST", body: { lead_id: id } }); if (r.status === "suppressed") throw new Error("Suppressed — on the do-not-contact list"); }, "Nudge sent ✓")}>Send the nudge</button>;
        if (k === "reactivate") return <button className="btn small" style={{ background: "#fff", color: "#14532d" }} onClick={() => act(() => api("/api/tasks", { method: "POST", body: { lead_id: id, type: "follow_up", title: "Reactivation: call today — decide if this is pipeline or history" } }), "Follow-up task created ✓")}>Create follow-up task</button>;
        if (k === "approve") return <button className="btn small" style={{ background: "#fff", color: "#14532d" }} onClick={() => { if (openApprovals) openApprovals(); else setTab("proposals"); }}>Open the approval →</button>;
        if (k === "fix_step") return <button className="btn small" style={{ background: "#fff", color: "#14532d" }} onClick={() => act(() => api("/api/leads/" + id, { method: "PATCH", body: { next_action: "Follow up", next_action_due_at: new Date(Date.now() + 86400000).toISOString() } }), "Next step set for tomorrow ✓")}>Set next step: tomorrow</button>;
        if (k === "assign") return <select defaultValue="" style={{ width: 190, background: "#fff", color: "#14532d", fontWeight: 600 }} onChange={e => { const v = e.target.value; if (v) act(() => api("/api/leads/" + id, { method: "PATCH", body: { owner_id: v } }), "Owner assigned ✓"); }}><option value="">Assign owner…</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}</select>;
        if (k === "job") return <button className="btn small" style={{ background: "#fff", color: "#14532d" }} onClick={async () => { if (d.job_id && openJob) { openJob(d.job_id); } else { const r = await api("/api/jobs", { method: "POST", body: { lead_id: id } }).catch((e: any) => ({ error: e.message })); if (r.error) setMsg(r.error); else { toast("Job created ✓"); if (r.id && openJob) openJob(r.id); else load(); } } }}>{d.job_id ? "Open the job →" : "Create the job →"}</button>;
        if (["call", "nudge", "reactivate", "work"].includes(k)) return goTab("messages", "Open messages →");
        return null; })()}
    </div>}
    {d.next_step && d.next_step.kind === "closed" && <div className="card" style={{ margin: "10px 0", padding: "10px 14px", background: "#f8fafc" }}><b>🔒 {d.next_step.label}</b> <span className="muted">{d.next_step.detail}</span></div>}
    <div className="tabs"><button className={tab === "details" ? "on" : ""} onClick={() => setTab("details")}>Details</button><button className={tab === "activity" ? "on" : ""} onClick={() => setTab("activity")}>Activity & Tasks</button><button className={tab === "proposals" ? "on" : ""} onClick={() => setTab("proposals")}>Proposals & Files ({d.proposals.length})</button><button className={tab === "messages" ? "on" : ""} onClick={() => setTab("messages")}>Messages</button><button className={tab === "crew" ? "on" : ""} onClick={() => setTab("crew")}>Crew & Time</button><button className={tab === "feed" ? "on" : ""} onClick={() => setTab("feed")}>Feed & Notes</button></div>
    {tab === "feed" && <div><FeedPanel type="lead" id={id} /><div style={{ marginTop: 16 }}><NotesPanel type="lead" id={id} /></div></div>}
    {tab === "details" && <div>
      <div className="formgrid">
        <div><label className="f">Contact name</label><input value={edit.contact_name || ""} onChange={e => setEdit({ ...edit, contact_name: e.target.value })} /></div>
        <div><label className="f">Phone</label><input value={edit.contact_phone || ""} onChange={e => setEdit({ ...edit, contact_phone: e.target.value })} /></div>
        <div><label className="f">Email</label><input value={edit.contact_email || ""} onChange={e => setEdit({ ...edit, contact_email: e.target.value })} /></div>
        <div><label className="f">Service</label><input value={edit.service_requested || ""} onChange={e => setEdit({ ...edit, service_requested: e.target.value })} /></div>
        <div><label className="f">Estimated value ($)</label><input type="number" value={edit.est_value ?? 0} onChange={e => setEdit({ ...edit, est_value: e.target.value })} /></div>
        <div><label className="f">Urgency</label><select value={edit.urgency || ""} onChange={e => setEdit({ ...edit, urgency: e.target.value })}><option value="emergency">Emergency</option><option value="this_week">This week</option><option value="flexible">Flexible</option></select></div>
        <div><label className="f">Owner</label><select value={edit.owner_id || ""} onChange={e => setEdit({ ...edit, owner_id: e.target.value })}><option value="">— unassigned —</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}</select></div>
        <div><label className="f">Project manager</label><select value={edit.pm_id || ""} onChange={e => setEdit({ ...edit, pm_id: e.target.value })}><option value="">— none —</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
        <div className="full"><label className="f">Next action</label><input value={edit.next_action || ""} onChange={e => setEdit({ ...edit, next_action: e.target.value })} /></div>
        <div className="full"><label className="f">Notes / job details</label><textarea rows={3} value={edit.notes || ""} onChange={e => setEdit({ ...edit, notes: e.target.value })} /></div>
      </div>
      <div className="rowflex" style={{ marginTop: 12 }}><button className="btn" onClick={save}>Save changes</button>
        <select style={{ width: 220 }} defaultValue="" onChange={e => { const v = e.target.value; e.target.value = ""; if (!v) return; if (FINALS.includes(v)) setFinalPick({ to: v, reason: "", confirm: false }); else stageTo(v); }}><option value="">Move to any stage…</option>{STATES.filter(s => s !== l.state).map(s => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</select>
        <button className="btn ghost" onClick={async () => setCheck(await api(`/api/leads/${id}/packet-check`, { method: "POST", body: {} }))}>Run readiness check</button></div>
      {check && <div className="card" style={{ marginTop: 12 }}><h3>Readiness — {check.complete ? "✅ Everything in place" : "⚠ Gaps below (warnings, not walls — you can still move and send)"} · score {check.score}/100</h3>
        {["contact name", "contact phone or email", "service requested", "service location", "scope notes", "project manager", "proposal", "proposal line items from price book"].map((label: string) => { const okc = !(check.missing || []).includes(label); return <div className="check" key={label}><span className={`st ${okc ? "pass" : "fail"}`}>{okc ? "✓" : "✗"}</span><span>{label}{okc ? "" : " — missing"}</span></div>; })}
        {(check.flags || []).map((fl: string, i: number) => <p className="muted" key={i}>⚑ {fl}</p>)}</div>}
      <CustomFieldsSection objectType="lead" entityId={id} custom={(() => { try { return JSON.parse(l.custom || "{}"); } catch { return {}; } })()} reload={load} />
    </div>}
    {tab === "activity" && <div>
      <div className="card"><h3>Log contact (20 seconds)</h3>
        <div className="rowflex"><select style={{ width: 110 }} value={act.type} onChange={e => setAct({ ...act, type: e.target.value })}><option>call</option><option>text</option><option>email</option><option>visit</option></select><input style={{ flex: 1 }} placeholder="What happened?" value={act.body} onChange={e => setAct({ ...act, body: e.target.value })} /><button className="btn small" onClick={async () => { await api(`/api/leads/${id}/contact`, { method: "POST", body: act }); setAct({ type: "call", body: "", outcome: "" }); load(); }}>Log</button></div>
        <div className="feed" style={{ marginTop: 10 }}>{d.activities.map((a: any) => <div className="ev" key={a.id}><b>{a.type}</b> — {a.body} <span>· {a.user_name || ""} · {dt(a.created_at)}</span></div>)}{d.activities.length === 0 && <p className="muted">No activity logged yet.</p>}</div></div>
      <div className="card"><h3>Schedule a callback</h3><CallbackForm leadId={id} done={load} /></div>
      <div className="card"><h3>Tasks ({d.tasks.filter((t: any) => t.status === "open").length} open)</h3>
        {d.tasks.map((t: any) => <div className="check" key={t.id}><span className={`st ${t.status === "done" ? "pass" : ""}`}>{t.status === "done" ? "✓" : "○"}</span><span style={{ flex: 1 }}>{t.title} <span className="muted">due {dOnly(t.due_at)}</span></span>{t.status === "open" && <button className="btn ghost small" onClick={async () => { await api(`/api/tasks/${t.id}/complete`, { method: "POST", body: {} }); load(); }}>Done</button>}</div>)}
        <div className="feed" style={{ marginTop: 12 }}><h3>Timeline</h3>{d.events.map((e: any) => <div className="ev" key={e.id}><span className="chip" style={{ marginRight: 6 }}>{e.actor === "ai-automation" ? "🤖 agent" : e.actor === "system" ? "⚙️ system" : "👤 human"}</span>{e.type.replaceAll("_", " ")}{e.to_state ? ` → ${e.to_state}` : ""} <span>· {dt(e.created_at)}</span></div>)}</div></div>
    </div>}
    {tab === "messages" && <MessagesPanel lead={d.lead} />}
    {tab === "crew" && <CrewTime lead={l} users={users} reloadLead={load} />}
    {tab === "proposals" && <div>
      <AttachmentsPanel entityType="lead" entityId={id} />
      <div className="card"><h3>Proposals</h3>
        {d.proposals.map((p: any) => <div key={p.id} style={{ borderBottom: "1px solid #eef2f7", padding: "8px 0" }}><b>v{p.version} · {money(p.total)}</b> · {p.status}{p.signed_at ? " · ✅ signed" : ""} · payment {p.payment_status || "—"}{p.view_count ? ` · 👁 viewed ${p.view_count}× (first ${dt(p.first_viewed_at)})` : " · not viewed yet"}{p.expires_at ? (new Date(p.expires_at) < new Date() && !p.signed_at ? ` · ⏰ expired ${dOnly(p.expires_at)}` : ` · valid until ${dOnly(p.expires_at)}`) : ""}{p.options ? (() => { try { const o = JSON.parse(p.options); return ` · options: ${o.map((x: any) => `${x.name} ${money(x.total)}`).join(" / ")}${p.selected_option ? " → picked: " + p.selected_option : ""}`; } catch { return ""; } })() : ""}<br />
          <span className="rowflex" style={{ marginTop: 5 }}><button className="btn ghost small" onClick={async () => { const r = await api(`/api/proposals/${p.id}/sign-link`, { method: "POST", body: {} }); navigator.clipboard && navigator.clipboard.writeText(location.origin + "/sign/" + r.token); setMsg("Sign link copied: /sign/" + r.token); }}>Copy sign link</button>
          <button className="btn ghost small" onClick={async () => { const r = await api(`/api/proposals/${p.id}/deposit`, { method: "POST", body: {} }); setMsg(`Deposit link (${r.mode}): ${r.link}`); }}>Deposit link</button>
          <a className="btn ghost small" style={{ textDecoration: "none" }} href={`/api/proposals/${p.id}/docx`}>DOCX</a>
          <a className="btn ghost small" style={{ textDecoration: "none" }} href={`/print/proposal/${p.id}`} target="_blank" rel="noreferrer">🖨 Print / PDF</a>
          <button className="btn ghost small" onClick={async () => { const r = await api(`/api/proposals/${p.id}/clone`, { method: "POST", body: {} }); setMsg(`Cloned as v${r.version} (draft) ✓`); load(); }}>⧉ Clone</button>
          {p.status !== "signed" && p.status !== "withdrawn" && <button className="btn ghost small" onClick={async () => { if (!confirm("Withdraw this proposal? Its sign link stops working immediately.")) return; await api(`/api/proposals/${p.id}/withdraw`, { method: "POST", body: {} }); setMsg("Proposal withdrawn — its sign link no longer accepts a signature."); load(); }}>Withdraw</button>}
          <button className="btn ghost small" onClick={() => stageTo("SENT")}>Mark sent</button>
          <button className="btn small" onClick={async () => { const r = await api(`/api/proposals/${p.id}/send`, { method: "POST", body: { channel: "email" } }).catch((e: any) => ({ error: e.message })); setMsg(r.error ? "Send failed: " + r.error : `Proposal emailed to customer — delivery status: ${r.status}${r.status === "test_mode" ? " (test mode: recorded, not sent — add RESEND_API_KEY to go live)" : ""}`); load(); }}>✉ Send to customer</button>
          <button className="btn ghost small" onClick={async () => { const r = await api(`/api/proposals/${p.id}/send`, { method: "POST", body: { channel: "sms" } }).catch((e: any) => ({ error: e.message })); setMsg(r.error ? "SMS failed: " + r.error : `Proposal texted — status: ${r.status}`); load(); }}>💬 Text it</button></span></div>)}
        <label className="f">Build proposal — price book only</label>
        {items.map((it, i) => { const pb = priceBook.find((p: any) => p.id === it.price_book_item_id); const overridden = pb && it.unit_price !== undefined && it.unit_price !== "" && Number(it.unit_price) !== Number(pb.standard_price); return <div className="rowflex" key={i}><select style={{ flex: 2 }} value={it.price_book_item_id || ""} onChange={e => { const n = [...items]; n[i] = { ...n[i], price_book_item_id: e.target.value }; setItems(n); }}><option value="">Choose item…</option>{priceBook.map((pb2: any) => <option key={pb2.id} value={pb2.id}>{pb2.name} — {money(pb2.standard_price)}</option>)}</select><input style={{ width: 70 }} type="number" value={it.qty || 1} onChange={e => { const n = [...items]; n[i] = { ...n[i], qty: e.target.value }; setItems(n); }} title="Qty" /><input style={{ width: 95, borderColor: overridden ? "#d97706" : undefined, background: overridden ? "#fffbeb" : undefined }} type="number" placeholder={pb ? "Book " + money(pb.standard_price) : "Price"} value={it.unit_price ?? ""} onChange={e => { const n = [...items]; n[i] = { ...n[i], unit_price: e.target.value }; setItems(n); }} title="Unit price — change only with a reason (override is audited)" /><button className="btn ghost small" onClick={() => setItems(items.filter((_, x) => x !== i))}>✕</button></div>; })}
        {items.some(it => { const pb = priceBook.find((p: any) => p.id === it.price_book_item_id); return pb && it.unit_price !== undefined && it.unit_price !== "" && Number(it.unit_price) !== Number(pb.standard_price); }) && <div className="rowflex" style={{ marginTop: 6 }}><span className="chip" style={{ background: "#fffbeb", color: "#92400e", fontWeight: 700 }}>⚠ Price override</span><input style={{ flex: 1 }} placeholder="Reason for changing a price-book price (required — recorded in the audit trail)" value={overrideReason} onChange={e => setOverrideReason(e.target.value)} /></div>}
        {useOpts && <div>{optEditor(optB, setOptB, "Option B — Recommended")}{optEditor(optC, setOptC, "Option C — Complete")}<p className="muted" style={{ fontSize: 12 }}>Option A “Essential” = the lines above. The customer picks one option when signing; the job is priced from their pick.</p></div>}
        <div className="rowflex" style={{ marginTop: 8 }}><button className="btn ghost small" onClick={() => setItems([...items, { qty: 1 }])}>+ Line item</button><label className="muted" style={{ fontSize: 12.5 }}>Valid <input type="number" style={{ width: 60 }} value={validDays} onChange={e => setValidDays(Number(e.target.value) || 0)} /> days</label><label className="muted" style={{ fontSize: 12.5 }}><input type="checkbox" style={{ width: "auto" }} checked={useOpts} onChange={e => setUseOpts(e.target.checked)} /> Offer options (Good / Better / Best)</label>{docTpls.length > 0 && <label className="muted" style={{ fontSize: 12.5 }}>Template <select style={{ width: 190 }} value={docTpl} onChange={e => { setDocTpl(e.target.value); setTplTouched(true); }}>{docTpls.map(t => <option key={t.id} value={t.id}>{t.name}{t.is_default ? " ⭐" : ""}</option>)}</select>{!tplTouched && docTpls.find(t => t.id === docTpl)?.applies_to ? " ⚡ auto for " + docTpls.find(t => t.id === docTpl).applies_to : ""}</label>}<button className="btn small" onClick={buildProposal}>Draft proposal</button></div></div>
      <div className="card"><h3>Documents & visits</h3>
        {d.documents.map((doc: any) => <div className="check" key={doc.id}><span className={`st ${doc.status === "received" ? "pass" : "fail"}`}>{doc.status === "received" ? "✓" : "✗"}</span><span style={{ flex: 1 }}>{doc.name}{doc.expires_at && <span className="chip" style={{ marginLeft: 8, background: (new Date(doc.expires_at).getTime() - Date.now()) < 14 * 86400000 ? "#fde8e8" : "#eef2f7", color: (new Date(doc.expires_at).getTime() - Date.now()) < 0 ? "#b3261e" : "#5b6b62" }}>{(new Date(doc.expires_at).getTime() - Date.now()) < 0 ? "expired " : "expires "}{dOnly(doc.expires_at)}</span>}</span><label className="tiny muted">expires <input type="date" style={{ width: 128, padding: 2 }} defaultValue={doc.expires_at ? String(doc.expires_at).slice(0, 10) : ""} onChange={async e => { await api(`/api/documents/${doc.id}`, { method: "PATCH", body: { expires_at: e.target.value || null } }); load(); }} /></label>{doc.status !== "received" && <button className="btn ghost small" onClick={async () => { await api(`/api/documents/${doc.id}`, { method: "PATCH", body: { status: "received" } }); load(); }}>Mark received</button>}</div>)}
        {d.site_visits.map((v: any) => <p key={v.id} className="muted" style={{ margin: "4px 0" }}>📍 Visit {dt(v.scheduled_at)} — {v.status}</p>)}
        {d.approvals?.length > 0 && <div style={{ marginTop: 10 }}><h3>Approval history</h3>{d.approvals.map((a: any) => <p key={a.id} className="muted" style={{ margin: "4px 0" }}>{a.tier} · {a.decision || "pending"}{a.reason_code ? " · " + a.reason_code : ""} · {dt(a.submitted_at)}</p>)}</div>}
      </div>
    </div>}
  </div></div>);
}

function Approvals({ openLead }: any) {
  const [rows, setRows] = useState<any[]>([]); const [reason, setReason] = useState<Record<string, string>>({});
  const load = () => { api("/api/approvals").then(setRows).catch(() => {}); };
  useEffect(load, []);
  const decide = async (a: any, decision: string) => { try { await api(`/api/approvals/${a.id}/decide`, { method: "POST", body: { decision, reason_code: reason[a.id] || undefined } }); load(); } catch (e: any) { alert(e.message === "reason_required" ? "Rejections need a reason — pick one first." : e.message); } };
  return (<div><h2 className="pt">Approval Inbox</h2><p className="sub">Complete packets only — the Gate already verified contact, scope, visit, PM and price-book pricing. Target: approve in under 10 seconds.</p>
    {rows.length === 0 && <div className="card" style={{ textAlign: "center", padding: 34 }}><div style={{ fontSize: 34 }}>🎉</div><b>Inbox zero.</b><p className="muted">Nothing is waiting on an approver. Every packet that needed a decision got one — this is what a cleared pile looks like. New submissions land here the second they pass the Completeness Gate.</p></div>}
    {rows.map(a => <div className="card" key={a.id}>
      <div className="rowflex" style={{ justifyContent: "space-between" }}><div><b style={{ fontSize: 16 }}>{a.service_requested}</b> <span className="muted">for {a.contact_name}</span><br /><span className="muted">{money(a.est_value)} · {a.tier} tier · submitted {dt(a.submitted_at)} · age {a.age_hours}h</span></div>
      <button className="btn ghost small" onClick={() => openLead(a.lead_id)}>Open full record →</button></div>
      {a.proposal?.line_items && <table style={{ marginTop: 10 }}><thead><tr><th>Line item</th><th>Qty</th><th>Unit</th><th>Amount</th></tr></thead><tbody>{a.proposal.line_items.map((li: any, i: number) => <tr key={i}><td>{li.name}</td><td>{li.qty}</td><td>{money(li.unit_price)}</td><td>{money(li.qty * li.unit_price)}</td></tr>)}<tr><td colSpan={3}><b>Total</b></td><td><b>{money(a.proposal.total)}</b></td></tr></tbody></table>}
      <div style={{ marginTop: 10 }}>{(a.checks || []).map((c: any, i: number) => <div className="check" key={i}><span className={`st ${c.ok ? "pass" : "fail"}`}>{c.ok ? "✓" : "✗"}</span><span>{c.label || c.name}</span></div>)}</div>
      <div className="rowflex" style={{ marginTop: 12 }}><button className="btn" onClick={() => decide(a, "approved")}>✓ Approve</button>
        <select style={{ width: 210 }} value={reason[a.id] || ""} onChange={e => setReason({ ...reason, [a.id]: e.target.value })}><option value="">Rejection reason…</option><option value="PRICE_TOO_HIGH">Price too high</option><option value="PRICE_TOO_LOW">Price too low</option><option value="INCOMPLETE_SCOPE">Incomplete scope</option><option value="MISSING_INFO">Missing info</option><option value="TIMING">Timing</option><option value="OTHER">Other</option></select>
        <button className="btn danger" onClick={() => decide(a, "rejected")}>Reject</button></div>
    </div>)}
  </div>);
}

function Imports() {
  const [csv, setCsv] = useState("name,phone,email,service,value,location\nPat Lee,+15165550199,pat@example.com,Roofing quote,3200,Bay Shore NY");
  const [format, setFormat] = useState("generic");
  const [res, setRes] = useState<any>(null); const [hist, setHist] = useState<any[]>([]); const [msg, setMsg] = useState("");
  const load = () => { api("/api/imports").then(setHist).catch(() => {}); };
  useEffect(load, []);
  const run = async () => { try { const r = await api("/api/imports/csv", { method: "POST", body: { csv, filename: "web-import.csv", format } }); setRes(r); load(); } catch (e: any) { setMsg(e.message); } };
  const onFile = (f: File) => f.text().then(t => setCsv(t));
  const [eFmt, setEFmt] = useState("mbox"); const [eContent, setEContent] = useState(""); const [eRes, setERes] = useState<any>(null); const [eBusy, setEBusy] = useState(false);
  const [bands, setBands] = useState<any>(null); const [cPrev, setCPrev] = useState<any>(null); const [cActs, setCActs] = useState<any>({ dedupe: true, spam: true, score: true, assign: false }); const [cRes, setCRes] = useState<any>(null);
  const loadBands = () => { api("/api/backlog/bands").then(setBands).catch(() => {}); };
  useEffect(loadBands, []);
  const cScan = async () => { setCPrev(await api("/api/ai/cleanup/preview", { method: "POST", body: {} })); setCRes(null); };
  const cApply = async () => { const chosen = Object.entries(cActs).filter(([, v]) => v).map(([k]) => k); const r = await api("/api/ai/cleanup/apply", { method: "POST", body: { actions: chosen } }); setCRes(r); setCPrev(null); loadBands(); };
  const runEmail = async () => { setEBusy(true); try { const r = await api("/api/imports/email", { method: "POST", body: { format: eFmt, content: eContent, filename: "email-backlog." + eFmt } }); setERes(r); load(); } catch (e: any) { setMsg(e.message); } setEBusy(false); };
  return (<div><h2 className="pt">Import Leads</h2><p className="sub">Bring the backlog in — CSV from any source. Columns are auto-mapped (name, phone, email, service, value, location); duplicates are detected by phone/email and skipped, never double-created.</p>
    {msg && <div className="err">{msg}</div>}
    <div className="card"><h3 style={{ marginTop: 0 }}>0 · Where are your leads? Pick your source</h3>
      <details className="srcGuide"><summary>🌐 WordPress site</summary><ol><li>In Settings → Integrations → REST API, generate an API key (shown once — copy it).</li><li>Easiest path: add the Website Form Embed script to your site footer (Settings → Integrations → Website Form Embed has the exact tag) — no plugin needed, consent captured automatically.</li><li>Or keep your form plugin (Contact Form 7 / WPForms / Gravity): add its webhook add-on → POST to <span className="mono">{location.origin}/v1/leads</span> with header <span className="mono">Authorization: Bearer YOUR_KEY</span> and JSON <span className="mono">{"{ contact: { name, email, phone }, service_requested, message }"}</span>.</li><li>Submit one test entry — it lands in Leads within seconds, deduped by phone/email.</li></ol></details>
      <details className="srcGuide"><summary>⚛️ React / Next / any custom website</summary><ol><li>Generate an API key in Settings → Integrations → REST API.</li><li>From your form handler (server-side, so the key stays secret) POST the payload in the REST API guide — same endpoint as WordPress. For purely public forms, use the Embed script instead so no key ships to browsers.</li><li>Retries are safe: the endpoint dedupes by phone/email.</li></ol></details>
      <details className="srcGuide"><summary>🗄 Another CRM (Salesforce, HubSpot, Jobber…)</summary><ol><li>One-time move: export everything to CSV there, import it below (vendor presets included — no column surgery).</li><li>Staying in both systems? Use Lead Sync (Settings → Integrations) to pull nightly, or Zapier/Make to push new records in live.</li><li>Won outcomes flow back out through the same API/webhooks, so the old system stays the record if you want it to be.</li></ol></details>
      <details className="srcGuide"><summary>📧 Company email (@yourcompany.com)</summary><ol><li>History: export the mailbox (Gmail Takeout .mbox / Outlook export) and drop it in step 2 below — every message is triaged into leads and owned inbox items.</li><li>Live sync that works today: a Zapier/Make automation — Trigger: new email in the company inbox → Action: Webhooks POST to <span className="mono">{location.origin}/v1/inbox</span> with your API key (full recipe in Settings → Integrations → Gmail + Outlook).</li><li>Once mail flows, prioritization is automatic: proposal and active-job mail is ⚡ HOT, urgent language or overdue follow-ups are 🔥 URGENT, and hot mail that waits too long ESCALATES to the owners with a bell alert.</li><li>One-click native Gmail/Outlook connect is built but waiting on platform app registration — the status in Integrations says so honestly rather than faking a connection.</li></ol></details>
      <details className="srcGuide"><summary>📄 Just a spreadsheet / CSV file</summary><ol><li>Use step 1 below — headers auto-map (name, phone, email, service, value, location).</li><li>Test with 10 rows first, verify created/duplicates, then run the full file.</li><li>Then run Backlog health (bottom of this page) to score and clean the pile.</li></ol></details>
    </div>
    <div className="card"><h3>1 · Choose file or paste CSV</h3>
      <div className="rowflex" style={{ marginBottom: 8 }}><label className="f" style={{ margin: 0 }}>This export came from</label><select style={{ width: 230 }} value={format} onChange={e => setFormat(e.target.value)}><option value="generic">Generic CSV</option><option value="jobber">Jobber</option><option value="housecallpro">Housecall Pro</option><option value="servicetitan">ServiceTitan</option><option value="salesforce">Salesforce</option></select><span className="muted">Vendor exports import as-is — no column surgery in Excel first.</span></div>
      <input type="file" accept=".csv" onChange={e => e.target.files && onFile(e.target.files[0])} />
      <textarea rows={9} style={{ marginTop: 10 }} value={csv} onChange={e => setCsv(e.target.value)} />
      <div className="rowflex" style={{ marginTop: 10 }}><button className="btn" onClick={run}>Import {csv.split("\n").filter(Boolean).length - 1 > 0 ? `(${csv.split("\n").filter(Boolean).length - 1} rows)` : ""}</button>
      {res && <span className="ok" style={{ margin: 0 }}>Created {res.created} · duplicates skipped {res.duplicates}</span>}</div>
      <p className="muted">Every imported lead lands owned, with a first-contact task and a 4-hour SLA — nothing enters unowned.</p></div>
    <div className="card"><h3>2 · Email backlog — import the whole inbox, auto-triaged</h3>
      <p className="muted">Export the pile once and drop it here: a <b>Gmail Takeout .mbox</b>, an email CSV, or JSON. Every message is triaged on arrival — quote requests become leads (deduped by phone/email), and proposals, field reports, active-job mail, vendor, finance, and admin each land as owned inbox items with a next step. Nothing needs reading one-by-one first.</p>
      <div className="rowflex" style={{ marginBottom: 8 }}><label className="f" style={{ margin: 0 }}>Format</label><select style={{ width: 230 }} value={eFmt} onChange={e => setEFmt(e.target.value)}><option value="mbox">Gmail Takeout (.mbox)</option><option value="csv">Email CSV</option><option value="json">JSON</option></select>
      <input type="file" accept=".mbox,.csv,.txt,.json" onChange={e => e.target.files && e.target.files[0].text().then(t => setEContent(t))} /></div>
      <textarea rows={5} placeholder={eFmt === "mbox" ? "…or paste the .mbox contents here" : eFmt === "csv" ? "from_email,from_name,subject,body,date\n…" : "[{\"from_email\": \"…\", \"subject\": \"…\", \"body\": \"…\"}]"} value={eContent} onChange={e => setEContent(e.target.value)} />
      <div className="rowflex" style={{ marginTop: 10 }}><button className="btn" disabled={eBusy || !eContent.trim()} onClick={runEmail}>{eBusy ? "Triaging…" : "Import & triage email backlog"}</button>
      {eRes && <span className="ok" style={{ margin: 0 }}>{eRes.received} messages → {eRes.leads_created} new leads · {eRes.duplicates} duplicates skipped</span>}</div>
      {eRes && <div className="rowflex" style={{ marginTop: 8 }}>{Object.entries(eRes.by_category).map(([k, v]: any) => <span className="st info" key={k}>{k.replaceAll("_", " ")}: {v}</span>)}</div>}
    </div>
    <div className="card"><h3>3 · Backlog health — what to work, what to park</h3>
      <p className="muted">Every lead is scored 0–100 (contact info, service fit, value, recency). Hot leads get worked first; the low band is <b>kept, not deleted</b> — it still feeds Reports and Demand Gap, because turned-away demand is how you spot your next service line.</p>
      {bands && <div className="rdyRow" style={{ margin: "8px 0" }}><span className="rdy ok">🔥 Hot ≥70 · {num(bands.hot)}</span><span className="rdy">🌤 Warm 40–69 · {num(bands.warm)}</span><span className="rdy warn">🧊 Low &lt;40 · {num(bands.low)}</span><span className="rdy">{bands.unscored > 0 ? `❔ Unscored · ${num(bands.unscored)}` : "✓ All scored"}</span><span className="rdy">{num(bands.total_all)} leads total</span></div>}
      <div className="rowflex"><button className="btn ghost" onClick={cScan}>Scan the pile</button>{bands && bands.hot > 0 && <button className="btn" onClick={async () => { const r = await api("/api/agent/triage-untouched", { method: "POST", body: {} }).catch(() => null); if (r && r.id) window.dispatchEvent(new CustomEvent("wp-agent", { detail: r.id })); }}>⚡ Work the untouched pile — agent drafts, you approve</button>}</div>
      {cPrev && <div style={{ marginTop: 10 }}><p style={{ margin: "4px 0" }}>Found: <b>{cPrev.duplicate_count}</b> duplicates · <b>{cPrev.spam_count}</b> spam/junk · <b>{cPrev.unassigned_count}</b> unassigned · <b>{cPrev.unscored_count}</b> unscored — of {num(cPrev.total_leads)} leads.</p>
        <div className="rowflex">{[["dedupe", "Archive duplicates (kept, reversible)"], ["spam", "Mark spam as junk"], ["score", "Score / re-score everything"], ["assign", "Auto-assign unassigned round-robin"]].map(([k, l]: any) => <label key={k} style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13 }}><input type="checkbox" style={{ width: "auto" }} checked={!!cActs[k]} onChange={e => setCActs({ ...cActs, [k]: e.target.checked })} />{l}</label>)}</div>
        <div className="rowflex" style={{ marginTop: 8 }}><button className="btn" onClick={cApply}>Apply cleanup</button><button className="btn ghost" onClick={() => setCPrev(null)}>Not now</button></div></div>}
      {cRes && <p className="ok">Cleanup done — {cRes.scored ? `${cRes.scored} scored · ` : ""}{cRes.archived_duplicates ? `${cRes.archived_duplicates} duplicates archived · ` : ""}{cRes.marked_spam ? `${cRes.marked_spam} spam junked · ` : ""}{cRes.assigned ? `${cRes.assigned} assigned` : ""} ✓</p>}
    </div>
    <div className="card"><h3>Import history</h3><table><thead><tr><th>File</th><th>When</th><th>Created</th><th>Duplicates</th><th>Status</th></tr></thead><tbody>
      {hist.map(h => { let t: any = {}; try { t = JSON.parse(h.totals || "{}"); } catch { t = {}; } return <tr key={h.id}><td>{h.filename}</td><td>{dt(h.created_at)}</td><td>{t.created ?? "—"}</td><td>{t.dupes ?? "—"}</td><td>{h.status}</td></tr>; })}
      {hist.length === 0 && <tr><td colSpan={5} className="muted">No imports yet.</td></tr>}</tbody></table></div>
  </div>);
}

function Demand({ openLead }: any) {
  const [rows, setRows] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null); const [leads, setLeads] = useState<any[]>([]);
  const [q, setQ] = useState(""); const [stF, setStF] = useState(""); const [sort, setSort] = useState("new");
  useEffect(() => { api("/api/demand-gap").then(setRows).catch(() => {}); }, []);
  useEffect(() => { if (sel) api("/api/demand-gap/leads?service=" + encodeURIComponent(sel.service)).then(setLeads).catch(() => setLeads([])); }, [sel?.service]);
  const recColor = (r: string) => r === "Launch" ? { background: "#dcfce7", color: "#166534" } : r === "Partner" ? { background: "#fef9c3", color: "#854d0e" } : {};
  if (sel) {
    let view = leads.filter(l => (!stF || l.state === stF) && (!q || JSON.stringify(l).toLowerCase().includes(q.toLowerCase())));
    view = [...view].sort((a, b) => sort === "value" ? (b.est_value || 0) - (a.est_value || 0) : String(b.created_at).localeCompare(String(a.created_at)));
    return (<div><button className="btn ghost small" onClick={() => setSel(null)}>← All clusters</button>
      <h2 className="pt" style={{ marginTop: 10 }}>{sel.service}</h2>
      <p className="sub">{num(sel.lead_count)} customers asked for this and were turned away · est. {money(sel.est_revenue)} (estimate · {sel.est_basis}) · <span className="tinyBadge" style={recColor(sel.recommendation)}>{sel.recommendation}</span> · Opportunity score {sel.opportunity_score}</p>
      <div className="rowflex" style={{ marginBottom: 10 }}>
        <input type="search" style={{ flex: 1, minWidth: 200 }} placeholder="Filter by name, phone, email, location…" value={q} onChange={e => setQ(e.target.value)} />
        <select style={{ width: 180 }} value={stF} onChange={e => setStF(e.target.value)}><option value="">All closure types</option><option value="UNSERVICEABLE">Unserviceable</option><option value="LOST">Lost</option></select>
        <select style={{ width: 170 }} value={sort} onChange={e => setSort(e.target.value)}><option value="new">Newest first</option><option value="value">Highest value</option></select>
        <span className="muted">{view.length} of {leads.length} shown</span>
      </div>
      <div className="card" style={{ padding: "4px 14px" }}><table><thead><tr><th>Contact</th><th>Phone</th><th>Email</th><th>Location</th><th>Asked</th><th>Value</th><th>Closed as</th><th>Reason</th></tr></thead><tbody>
        {view.map((l: any) => <tr className="clickable" key={l.id} onClick={() => openLead(l.id)}><td><b>{l.contact_name}</b></td><td>{l.contact_phone || "—"}</td><td>{l.contact_email || "—"}</td><td>{l.location || "—"}</td><td>{dOnly(l.created_at)}</td><td>{money(l.est_value)}</td><td><Badge s={l.state} /></td><td>{(l.lost_reason || "—").replaceAll("_", " ")}</td></tr>)}
        {view.length === 0 && <tr><td colSpan={8} className="muted">No leads match these filters.</td></tr>}
      </tbody></table></div>
      <p className="muted">Click any row to open the full lead record.</p>
    </div>);
  }
  return (<div><h2 className="pt">Demand Gap</h2><p className="sub">Services customers keep asking for that you don't sell yet — clustered from leads turned away because the service isn't offered. Price losses, no-responses, out-of-area and competitor losses are <b>not</b> counted here. Estimates are labeled estimates, never presented as booked revenue.</p>
    {rows.map((r, i) => <div className="card clickable" key={i} onClick={() => setSel(r)} style={{ cursor: "pointer" }}><div className="rowflex" style={{ justifyContent: "space-between" }}><b style={{ fontSize: 16 }}>{r.service}</b><span style={{ display: "inline-flex", gap: 6 }}><span className="tinyBadge" style={recColor(r.recommendation)}>{r.recommendation}</span><span className="badge b-READY_FOR_APPROVAL">Opportunity score {r.opportunity_score}</span></span></div>
      <p className="muted" style={{ margin: "8px 0 4px" }}>{num(r.lead_count)} leads asked · est. {money(r.est_revenue)} turned away (estimate) · basis: {r.est_basis}</p>
      <p style={{ margin: "4px 0" }}>{r.recommendation === "Launch" ? "Enough repeated demand to price it, staff it, and add it to the catalog." : r.recommendation === "Partner" ? "Real demand, thin volume — refer it to a partner for a cut instead of staffing it." : "Watch it — demand exists but is too thin to act on yet."}</p>
      <p style={{ margin: "4px 0" }}><span className="muted">Click to see all {num(r.lead_count)} leads →</span></p></div>)}
    {rows.length === 0 && <div className="card">No unmet-demand clusters yet — when customers ask for services you don't offer, they'll surface here.</div>}
  </div>);
}

function Handoffs() {
  const [rows, setRows] = useState<any[]>([]); const [outbox, setOutbox] = useState<any[]>([]); const [flt, setFlt] = useState("");
  const load = () => { api("/api/handoffs").then(setRows).catch(() => {}); api("/api/outbox").then(setOutbox).catch(() => {}); };
  useEffect(load, []);
  const shown = rows.filter(r => !flt || r.last_status === flt || r.outcome === flt);
  return (<div><h2 className="pt">Handoff Monitor</h2><p className="sub">Every final outcome — won, lost, no-response, N/A — delivered into the customer's own system. A delivery only reads "delivered" after a real 2xx from their endpoint; "acknowledged" means their system confirmed the ID.</p>
    <div className="chips">{["", "acknowledged", "delivered", "pending", "dead_letter", "won", "lost", "na_unserviceable"].map(s => <button key={s || "all"} className={`chip ${flt === s ? "on" : ""}`} onClick={() => setFlt(s)}>{s || "All"} </button>)}</div>
    <div className="card" style={{ padding: 6 }}><table><thead><tr><th>Outcome</th><th>Status</th><th>Attempts</th><th>Their ID</th><th>Delivered</th><th></th></tr></thead><tbody>
      {shown.slice(0, 100).map(r => <tr key={r.id}><td><b>{r.outcome}</b></td><td>{r.last_status}</td><td>{r.attempts}</td><td>{r.external_id || "—"}</td><td>{dt(r.delivered_at)}</td><td>{["pending", "failed", "dead_letter"].includes(r.last_status) && <button className="btn ghost small" onClick={async () => { await api(`/api/handoffs/${r.id}/replay`, { method: "POST", body: {} }); load(); }}>Replay</button>}</td></tr>)}
    </tbody></table>{shown.length > 100 && <p className="muted" style={{ padding: 10 }}>Showing first 100 of {num(shown.length)}.</p>}</div>
    <div className="card"><h3>Outbox (last 100)</h3>{outbox.slice(0, 12).map((o: any) => <p key={o.id} className="muted" style={{ margin: "4px 0" }}>{o.kind} · {o.status} · attempts {o.attempts} · {dt(o.created_at)}{o.last_error ? " · " + o.last_error : ""}</p>)}</div>
  </div>);
}

function EnhanceBtn({ text, onText, purpose }: any) {
  const [busy, setBusy] = useState(false); const [note, setNote] = useState("");
  const go = async () => { if (!String(text || "").trim() || busy) return; setBusy(true); setNote(""); const r = await api("/api/ai/enhance", { method: "POST", body: { text, purpose: purpose || "business message" } }).catch((e: any) => ({ source: "none", note: e.message })); if (r.source === "ai") { onText(r.text); setNote("✨ Enhanced by AI — review before sending"); } else setNote(r.note || "No AI provider connected yet."); setBusy(false); };
  return <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><button className="btn ghost small" disabled={!String(text || "").trim() || busy} onClick={go}>{busy ? "✨ Enhancing…" : "✨ Enhance with AI"}</button>{note && <span className="muted" style={{ fontSize: 12 }}>{note}</span>}</span>;
}

function AttachPicker({ leadId, value, onChange }: any) {
  const [open, setOpen] = useState(false); const [groups, setGroups] = useState<any>(null);
  useEffect(() => { if (open && !groups) { api("/api/attachables" + (leadId ? "?lead_id=" + leadId : "")).then(setGroups).catch(() => {}); } }, [open ]);
  const add = (x: any) => { if (!value.some((v: any) => v.kind === x.kind && v.id === x.id)) onChange([...value, { kind: x.kind, id: x.id, label: x.label, why: x.why }]); };
  const upload = async (f: File) => { const buf = await f.arrayBuffer(); const bytes = new Uint8Array(buf); let bin = ""; for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192)); const b64 = btoa(bin);
    let et = "workspace", eid = ""; if (leadId) { et = "lead"; eid = leadId; } else { const w = await api("/api/workspaces"); eid = w.current; }
    const r = await api("/api/attachments", { method: "POST", body: { entity_type: et, entity_id: eid, name: f.name, mime: f.type || "application/octet-stream", data_base64: b64 } });
    add({ kind: "attachment", id: r.id, label: f.name }); setGroups(null); toast("File attached ✓"); };
  const grp = (title: string, rows: any[]) => rows && rows.length ? <div style={{ marginTop: 8 }}><div className="muted" style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".05em" }}>{title}</div>{rows.map((x: any) => <div key={x.kind + x.id} className="rowflex" style={{ padding: "3px 0" }}><button className="btn ghost small" onClick={() => add(x)}>+ {x.label}</button><span className="muted">{x.detail || ""}</span></div>)}</div> : null;
  return (<div style={{ marginTop: 8 }}>
    <div className="rowflex">{value.map((v: any) => <span key={v.kind + v.id} className="chip on" title={v.why || ""} style={{ cursor: "default" }}>📎 {v.label}{v.why ? " · AI" : ""} <b style={{ cursor: "pointer" }} onClick={() => onChange(value.filter((x: any) => !(x.kind === v.kind && x.id === v.id)))}>×</b></span>)}
      <button className="btn ghost small" onClick={() => setOpen(o => !o)}>📎 Attach</button></div>
    {open && <div className="card" style={{ marginTop: 8, padding: "10px 14px" }}>
      <label className="btn ghost small" style={{ cursor: "pointer" }}>⬆ Upload a file<input type="file" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} /></label>
      {!groups && <p className="muted">Loading documents…</p>}
      {groups && <>{grp("COMPANY DOCUMENTS", groups.company)}{grp("FILES ON THIS RECORD", groups.files)}{grp("PROPOSALS", groups.proposals)}{grp("INVOICES", groups.invoices)}</>}
      <p className="muted" style={{ marginTop: 8 }}>Pick from this record or the company vault — the file is attached to the email when you send. AI-suggested attachments are marked "AI" with the reason on hover.</p>
    </div>}
  </div>);
}

function InboxQueue({ inbox, reload }: any) {
  const [cat, setCat] = useState("all"); const [openId, setOpenId] = useState(""); const [sug, setSug] = useState<any>(null); const [draft, setDraft] = useState(""); const [msg, setMsg] = useState(""); const [att, setAtt] = useState<any[]>([]);
  const cats = ["all", "client_active_job", "proposal", "field", "vendor", "finance", "admin"];
  const counts: Record<string, number> = {}; for (const i of inbox) if ((i.status || "open") === "open") counts[i.category] = (counts[i.category] || 0) + 1;
  const openCount = inbox.filter((i: any) => (i.status || "open") === "open").length;
  const shown = inbox.filter((i: any) => cat === "all" || i.category === cat);
  const [comments, setComments] = useState<any[]>([]); const [canned, setCanned] = useState<any[]>([]); const [cText, setCText] = useState("");
  useEffect(() => { api("/api/canned-replies").then(setCanned).catch(() => {}); }, []);
  const expand = async (i: any) => { if (openId === i.id) { setOpenId(""); return; } setOpenId(i.id); setSug(null); setAtt([]); const r = await api("/api/inbox/" + i.id + "/suggestion").catch(() => null); setSug(r); if (r) { setDraft(r.draft_body); setAtt((r.attachments || []).map((x: any) => ({ kind: x.kind, id: x.id, label: x.label, why: x.why }))); } api("/api/inbox/" + i.id + "/claim", { method: "POST", body: {} }).catch(() => {}); api("/api/inbox/" + i.id + "/comments").then(setComments).catch(() => {}); };
  const act = async (fn: () => Promise<any>, okMsg: string) => { const r = await fn().catch((e: any) => ({ error: e.message })); setMsg(r?.error ? "Failed: " + r.error : okMsg); reload(); };
  return (<div className="card"><h3>Inbox queue — everything that isn't a lead, worked like a queue</h3>
    <p className="muted">Triaged on arrival, each with an owner, a due date, and an AI-suggested next action with a ready-to-send reply. {openCount} open.</p>
    {msg && <div className="ok">{msg}</div>}
    <div className="rowflex" style={{ marginBottom: 10 }}>{cats.map(c => <button key={c} className={"btn small " + (cat === c ? "" : "ghost")} onClick={() => setCat(c)}>{c === "all" ? `All (${openCount} open)` : `${c.replaceAll("_", " ")}${counts[c] ? ` (${counts[c]})` : ""}`}</button>)}</div>
    {shown.map((i: any) => { const doneIt = (i.status || "open") === "done"; return <div key={i.id} style={{ borderBottom: "1px solid #eef2f7", padding: "9px 0", opacity: doneIt ? 0.55 : 1 }}>
      <div className="rowflex" style={{ cursor: "pointer" }} onClick={() => expand(i)}><span className="badge b-TRIAGED">{i.category.replaceAll("_", " ")}</span>{i.priority?.tier === "urgent" && <span className="badge" style={{ background: "#fee2e2", color: "#991b1b" }}>🔥 URGENT</span>}{i.priority?.tier === "hot" && <span className="badge" style={{ background: "#fef3c7", color: "#92400e" }}>⚡ HOT</span>}{i.priority?.escalated && <span className="badge" style={{ background: "#7f1d1d", color: "#fff" }}>ESCALATED</span>}<b>{i.from_name || i.from_email}</b><span style={{ flex: 1 }}>{i.subject}</span>
        {i.overdue && !doneIt && <span className="st fail">overdue</span>}{doneIt ? <span className="st pass">done</span> : <span className="muted">due {dOnly(i.next_action_due_at)} · {i.owner_name || "unassigned"}</span>}</div>
      {openId === i.id && <div style={{ margin: "10px 0 4px", padding: 12, background: "#f8fafc", borderRadius: 10 }}>
        <div className="origMail"><div className="origHead"><b>📧 Original email</b><span className="muted">From {i.from_name || ""} &lt;{i.from_email || ""}&gt; · {dt(i.received_at || i.created_at)}</span></div><div className="origBody">{String(i.body || "(no body captured)")}</div></div>
        {sug ? <div><p style={{ margin: "0 0 4px" }}><b>🤖 Suggested: {sug.action}</b> {sug.source === "ai" ? <span className="tinyBadge" style={{ background: "#e7f6ec", color: "#14532d" }}>✨ AI draft — written from this email{sug.model ? " · " + sug.model : ""}</span> : <span className="tinyBadge" style={{ background: "#fef9c3", color: "#854d0e" }}>📄 Template draft — add an AI key in Automations for drafts written from the actual email</span>}<button className="btn ghost small" style={{ marginLeft: 8 }} onClick={async () => { const r = await api("/api/inbox/" + i.id + "/suggestion/regenerate", { method: "POST", body: {} }).catch(() => null); if (r) { setSug(r); setDraft(r.draft_body); if (r.source !== "ai") setMsg("No AI provider connected yet — add a key in Automations → AI provider and this button writes the reply from the email itself."); } }}>{sug.source === "ai" ? "↻ Regenerate" : "✨ Enhance with AI"}</button></p><p className="muted" style={{ margin: "0 0 8px" }}>{sug.why}</p>
          <label className="f">Reply — edit freely, sends from your workspace</label>
          <textarea rows={7} value={draft} onChange={e => setDraft(e.target.value)} />
          <div className="rowflex"><select style={{ width: 230 }} defaultValue="" onChange={e => { const c = canned.find((x: any) => x.id === e.target.value); if (c) setDraft(c.body); e.target.value = ""; }}><option value="">Insert a canned reply…</option>{canned.map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}</select><EnhanceBtn text={draft} onText={setDraft} purpose="email reply" />{i.claimed_by && <span className="tinyBadge">👀 being handled</span>}</div>
          <AttachPicker leadId={i.lead_id || null} value={att} onChange={setAtt} />
          {att.some((x: any) => x.why) && <p className="muted" style={{ margin: "4px 0 0" }}>🤖 AI pre-attached {att.filter((x: any) => x.why).map((x: any) => `${x.label} (${x.why.toLowerCase()})`).join("; ")} — review before sending; remove anything you don't want sent.</p>}
          <div className="rowflex" style={{ marginTop: 8 }}>
            <button className="btn small" onClick={() => act(async () => { const r = await api("/api/inbox/" + i.id + "/reply", { method: "POST", body: { body: draft, attachments: att.map((x: any) => ({ kind: x.kind, id: x.id })) } }); return r; }, "Reply queued/sent ✓ — item closed")}>✉ Send reply & close{att.length ? ` (${att.length} 📎)` : ""}</button>
            {!doneIt ? <button className="btn ghost small" onClick={() => act(() => api("/api/inbox/" + i.id, { method: "PATCH", body: { status: "done" } }), "Marked done ✓")}>✓ Mark done</button> : <button className="btn ghost small" onClick={() => act(() => api("/api/inbox/" + i.id, { method: "PATCH", body: { status: "open" } }), "Reopened ✓")}>Reopen</button>}
            <button className="btn ghost small" onClick={() => act(() => api("/api/inbox/" + i.id, { method: "PATCH", body: { snooze_days: 1 } }), "Snoozed to tomorrow ✓")}>💤 Snooze 1d</button>
            <button className="btn ghost small" onClick={() => act(() => api("/api/inbox/" + i.id + "/convert-task", { method: "POST", body: {} }), "Task created for the owner ✓")}>Make task</button>
            <button className="btn ghost small" onClick={() => act(() => api("/api/inbox/" + i.id + "/convert-lead", { method: "POST", body: {} }), "Converted to a lead ✓")}>Convert to lead</button>
          </div>
          <div style={{ marginTop: 12, borderTop: "1px solid #e5e7eb", paddingTop: 8 }}><b style={{ fontSize: 13 }}>Team discussion — on this email, not in a hallway</b>
            {comments.map((c: any) => <p key={c.id} style={{ margin: "5px 0", fontSize: 13 }}><b>{c.user_name || "Teammate"}</b> <span className="muted">{dt(c.created_at)}</span><br />{c.body}</p>)}
            <div className="rowflex"><input placeholder="Add a comment for the team…" value={cText} onChange={e => setCText(e.target.value)} style={{ flex: 1 }} /><button className="btn ghost small" disabled={!cText.trim()} onClick={async () => { await api("/api/inbox/" + i.id + "/comments", { method: "POST", body: { body: cText.trim() } }); setCText(""); api("/api/inbox/" + i.id + "/comments").then(setComments).catch(() => {}); }}>Comment</button></div></div></div> : <p className="muted">Loading suggestion…</p>}
      </div>}
    </div>; })}
    {shown.length === 0 && <p className="muted">Nothing here — this category is clear.</p>}
  </div>);
}


function Ops() {
  function FieldReportsCard() {
  const today = new Date().toLocaleDateString("en-CA");
  const [date, setDate] = useState(today); const [data, setData] = useState<any>(null);
  const [subId, setSubId] = useState(""); const [notes, setNotes] = useState(""); const [jobId, setJobId] = useState("");
  const [jobs, setJobs] = useState<any[]>([]); const [msg, setMsg] = useState("");
  const load = () => { api("/api/field-reports?date=" + date).then(setData).catch(() => {}); };
  useEffect(load, [date]);
  useEffect(() => { api("/api/schedule/jobs").then(setJobs).catch(() => {}); }, []);
  const shift = (n: number) => { const d = new Date(date + "T12:00:00"); d.setDate(d.getDate() + n); setDate(d.toLocaleDateString("en-CA")); };
  const submit = async (r: any) => { const res: any = await offlinePost(`/api/field-reports/${r.id}/submit`, { notes, lead_id: jobId || undefined }, "field report"); setSubId(""); setNotes(""); setJobId(""); if (res?.__offline) { setMsg("📴 No signal — report saved on this device and queued to sync."); return; } setMsg(`Report filed for ${r.manager} ✓`); load(); };
  const chase = async (r: any) => { const out = await api(`/api/field-reports/${r.id}/chase`, { method: "POST", body: {} }); setMsg(out.message || "Chase recorded"); load(); };
  const chaseAll = async () => { if (!data) return; const miss = data.rows.filter((x: any) => x.status === "missing"); let emailed = 0, test = 0, recorded = 0; for (const r of miss) { const out = await api(`/api/field-reports/${r.id}/chase`, { method: "POST", body: {} }).catch(() => ({ delivery: "recorded" })); if (out.delivery === "emailed") emailed++; else if (out.delivery === "test_mode") test++; else recorded++; } setMsg(`Chased ${miss.length}: ${emailed} emailed${test ? `, ${test} recorded in test mode (not delivered)` : ""}${recorded ? `, ${recorded} recorded — no email on file` : ""}`); load(); };
  return (<div className="card"><h3>Field reports — daily, expected, chased</h3>
    <div className="rowflex" style={{ marginBottom: 8 }}><button className="btn ghost small" onClick={() => shift(-1)}>← Prev day</button><b>{date}</b><button className="btn ghost small" onClick={() => shift(1)}>Next day →</button><button className="btn ghost small" onClick={() => setDate(today)}>Today</button>
      <span style={{ flex: 1 }} /><button className="btn ghost small" onClick={chaseAll}>📣 Chase all missing</button></div>
    {msg && <div className="ok">{msg}</div>}
    {!data && <p className="muted">Loading…</p>}
    {data && <><p className="muted" style={{ marginTop: 0 }}>{data.summary.submitted} of {data.rows.length} filed · {data.summary.missing} missing. A report is expected from every field manager, every day — missing ones past their day are chased automatically, once.</p>
    <table><thead><tr><th>Manager</th><th>Status</th><th>Job</th><th>Notes</th><th></th></tr></thead><tbody>
      {data.rows.map((r: any) => <tr key={r.id}><td>{r.manager}</td><td>{r.status === "submitted" ? <span className="st pass">filed</span> : r.overdue ? <span className="st fail">missing · overdue</span> : <span className="st warn">missing</span>}{r.chased_at ? <span className="muted"> · chased {dOnly(r.chased_at)}</span> : ""}</td><td>{r.job_service ? `${r.job_service} — ${r.job_customer || ""}` : <span className="muted">—</span>}</td><td className="muted">{r.notes ? String(r.notes).slice(0, 60) : ""}</td>
        <td><span className="rowflex">{r.status === "missing" && <button className="btn ghost small" onClick={() => chase(r)}>Chase</button>}<button className="btn ghost small" onClick={() => { setSubId(subId === r.id ? "" : r.id); setNotes(r.notes || ""); }}>{r.status === "submitted" ? "Edit" : "File report"}</button></span>
        {subId === r.id && <div style={{ marginTop: 8 }}><textarea rows={3} placeholder="What got done, what's blocked, what's needed tomorrow…" value={notes} onChange={e => setNotes(e.target.value)} />
          <select value={jobId} onChange={e => setJobId(e.target.value)} style={{ marginTop: 6 }}><option value="">Attach to a job (optional)…</option>{jobs.map((j: any) => <option key={j.id} value={j.id}>{j.service_requested} — {j.contact_name}</option>)}</select>
          <div className="rowflex" style={{ marginTop: 6 }}><button className="btn small" onClick={() => submit(r)}>Submit report</button><button className="btn ghost small" onClick={() => setSubId("")}>Cancel</button></div></div>}</td></tr>)}
      {data.rows.length === 0 && <tr><td colSpan={5} className="muted">No field managers (PM / Lead Owner roles) in this workspace yet.</td></tr>}
    </tbody></table></>}
  </div>);
}

function ScheduleCard() {
  const [users, setUsers] = useState<any[]>([]);
  useEffect(() => { api("/api/users").then(setUsers).catch(() => {}); }, []);
  const mondayOf = (d: Date) => { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x.toISOString().slice(0, 10); };
  const [week, setWeek] = useState(mondayOf(new Date())); const [data, setData] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]); const [sel, setSel] = useState<any>(null); const [jobId, setJobId] = useState(""); const [note, setNote] = useState(""); const [msg, setMsg] = useState("");
  const load = () => { api("/api/schedule?week=" + week).then(setData).catch(() => {}); };
  useEffect(load, [week]);
  useEffect(() => { api("/api/schedule/jobs").then(setJobs).catch(() => {}); }, []);
  const shift = (n: number) => { const d = new Date(week + "T12:00:00"); d.setDate(d.getDate() + n * 7); setWeek(mondayOf(d)); };
  const days = [0, 1, 2, 3, 4, 5, 6].map(i => { const d = new Date(week + "T12:00:00"); d.setDate(d.getDate() + i); return { iso: d.toISOString().slice(0, 10), lab: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i] + " " + (d.getMonth() + 1) + "/" + d.getDate() }; });
  const crew = users.filter((u: any) => ["PM", "LEAD_OWNER", "OPS_ADMIN"].includes(u.role) || (data?.rows || []).some((r: any) => r.user_id === u.id));
  const cell = (uid2: string, iso: string) => (data?.rows || []).filter((r: any) => r.user_id === uid2 && r.work_date === iso);
  const assign = async () => { if (!sel || !jobId) return; const r = await api("/api/schedule", { method: "POST", body: { user_id: sel.user_id, lead_id: jobId, work_date: sel.date, note } }).catch((e: any) => ({ error: e.message })); if ((r as any).error) setMsg("Couldn't assign: " + (r as any).error); else { setMsg("Scheduled ✓ — they've been notified"); setSel(null); setJobId(""); setNote(""); load(); window.dispatchEvent(new Event("wp-ops")); } };
  return (<div className="card"><h3>Crew schedule — who's on which job, this week</h3>
    <div className="rowflex" style={{ marginBottom: 8 }}><button className="btn ghost small" onClick={() => shift(-1)}>← Prev week</button><b>Week of {week}</b><button className="btn ghost small" onClick={() => shift(1)}>Next week →</button><button className="btn ghost small" onClick={() => setWeek(mondayOf(new Date()))}>This week</button></div>
    {(data?.jobs || []).length > 0 && <div style={{ marginBottom: 8 }}><b style={{ fontSize: 13 }}>🛠 Jobs starting this week</b><div className="rowflex" style={{ marginTop: 4 }}>{(data?.jobs || []).map((jb: any) => <span key={jb.id} className="schedChip" style={{ cursor: "pointer" }} onClick={() => (window as any).wpOpenJob?.(jb.id)}>🛠 {String(jb.scheduled_start).slice(5, 10)} · {String(jb.scheduled_start).slice(11, 16)} — {jb.service_requested} · {jb.contact_name}</span>)}</div></div>}
    {msg && <div className="ok">{msg}</div>}
    <div style={{ overflowX: "auto" }}><table><thead><tr><th>Worker</th>{days.map(d => <th key={d.iso}>{d.lab}</th>)}</tr></thead><tbody>
      {crew.map((u: any) => <tr key={u.id}><td><b>{u.name}</b><br /><span className="muted">{u.role}</span></td>{days.map(d => <td key={d.iso} style={{ minWidth: 118, verticalAlign: "top" }}>{cell(u.id, d.iso).map((e: any) => <div key={e.id} className={"schedChip" + (e.conflict ? " warn" : "")}><span style={{ flex: 1 }}>{e.conflict ? "⚠ " : ""}{e.service_requested} — {e.contact_name}</span><button className="btn ghost small" style={{ padding: "0 4px" }} onClick={async () => { await api("/api/schedule/" + e.id, { method: "DELETE" }); load(); window.dispatchEvent(new Event("wp-ops")); }}>✕</button></div>)}<button className="btn ghost small" onClick={() => setSel({ user_id: u.id, date: d.iso })}>+ Assign</button></td>)}</tr>)}
      {crew.length === 0 && <tr><td colSpan={8} className="muted">No crew members yet.</td></tr>}
    </tbody></table></div>
    <p className="muted">⚠ marks a double-booking — same person, two jobs, one day. Assigning notifies the worker.</p>
    {sel && <div className="card" style={{ marginTop: 10, background: "#f8fafc" }}><b>Assign {users.find((u: any) => u.id === sel.user_id)?.name} — {sel.date}</b>
      <div className="rowflex" style={{ marginTop: 8 }}><select value={jobId} onChange={e => setJobId(e.target.value)} style={{ flex: 1 }}><option value="">Pick a job (approved / sent / won)…</option>{jobs.map((j: any) => <option key={j.id} value={j.id}>{j.service_requested} — {j.contact_name} ({j.state})</option>)}</select>
      <input placeholder="Note (arrival time, phase…)" value={note} onChange={e => setNote(e.target.value)} style={{ flex: 1 }} />
      <button className="btn small" disabled={!jobId} onClick={assign}>Assign</button><button className="btn ghost small" onClick={() => setSel(null)}>Cancel</button></div></div>}
  </div>);

}

function TimesheetsCard() {
  const mondayOf = (d: Date) => { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x.toISOString().slice(0, 10); };
  const [week, setWeek] = useState(mondayOf(new Date())); const [data, setData] = useState<any>(null);
  const [editId, setEditId] = useState(""); const [days, setDays] = useState<any>({}); const [notes, setNotes] = useState(""); const [msg, setMsg] = useState("");
  const load = () => { api("/api/timesheets?week=" + week).then(setData).catch(() => {}); };
  useEffect(load, [week]);
  useEffect(() => { const h = () => load(); window.addEventListener("wp-ops", h); return () => window.removeEventListener("wp-ops", h); });
  const shift = (n: number) => { const d = new Date(week + "T12:00:00"); d.setDate(d.getDate() + n * 7); setWeek(mondayOf(d)); };
  const startEdit = (r: any) => { setEditId(r.id); setDays(r.days || {}); setNotes(r.notes || ""); };
  const save = async (r: any) => { await api("/api/timesheets", { method: "POST", body: { ...(r.worker_row ? { worker_id: r.worker_row } : { manager_id: r.manager_id }), week_of: week, days, notes } }); setEditId(""); setMsg(`Timesheet saved for ${r.manager} ✓`); load(); };
  const chase = async (r: any) => { const out = await api(`/api/timesheets/${r.id}/chase`, { method: "POST", body: {} }); setMsg(out.message || "Chase recorded"); load(); };
  const chaseAll = async () => { if (!data) return; const miss = data.rows.filter((x: any) => x.status === "missing"); let emailed = 0, test = 0, recorded = 0; for (const r of miss) { const out = await api(`/api/timesheets/${r.id}/chase`, { method: "POST", body: {} }).catch(() => ({ delivery: "recorded" })); if (out.delivery === "emailed") emailed++; else if (out.delivery === "test_mode") test++; else recorded++; } setMsg(`Chased ${miss.length}: ${emailed} emailed${test ? `, ${test} recorded in test mode (not delivered)` : ""}${recorded ? `, ${recorded} recorded — no email on file` : ""}`); load(); };
  const dayNames = [["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"]];
  return (<div className="card"><h3>Timesheets — logged, chased, payroll-ready</h3>
    <div className="rowflex" style={{ marginBottom: 8 }}><button className="btn ghost small" onClick={() => shift(-1)}>← Prev week</button><b>Week of {week}</b><button className="btn ghost small" onClick={() => shift(1)}>Next week →</button><button className="btn ghost small" onClick={() => setWeek(mondayOf(new Date()))}>This week</button>
      <span style={{ flex: 1 }} />
      <button className="btn ghost small" onClick={chaseAll}>📣 Chase all missing</button>
      <a className="btn ghost small" style={{ textDecoration: "none" }} href={`/api/timesheets/export?week=${week}`}>⬇ Payroll CSV</a></div>
    {msg && <div className="ok">{msg}</div>}
    {!data && <p className="muted">Loading…</p>}
    {data && <><p className="muted" style={{ marginTop: 0 }}>{data.summary.submitted} of {data.rows.length} submitted · {data.summary.total_hours} grid hours · {data.summary.job_hours || 0} job hours ({money(data.summary.job_cost || 0)} labor) · {data.summary.missing} missing. Expected sheets are created automatically for every field manager; missing ones past their week get chased automatically (and you can chase any time).</p>
    <table><thead><tr><th>Manager</th><th>Status</th><th>Grid hrs</th><th>Job hrs</th><th>Labor $</th><th></th></tr></thead><tbody>
      {data.rows.map((r: any) => <tr key={r.id}><td>{r.manager}</td><td>{r.status === "submitted" ? <span className="st warn">submitted</span> : r.status === "reviewed" ? <span className="st warn">reviewed</span> : r.status === "approved" ? <span className="st pass">approved ✓</span> : r.status === "rejected" ? <span className="st fail">rejected{r.rejection_reason ? " — " + r.rejection_reason : ""}</span> : r.status === "exported" ? <span className="st pass">exported</span> : r.overdue ? <span className="st fail">missing · overdue</span> : <span className="st warn">missing</span>}{r.chased_at ? <span className="muted"> · chased {dOnly(r.chased_at)}</span> : ""}</td><td>{r.hours ?? "—"}</td><td>{r.job_hours || "—"}</td><td>{r.job_cost ? money(r.job_cost) : "—"}</td>
        <td><span className="rowflex">{r.status === "missing" && <button className="btn ghost small" onClick={() => chase(r)}>Chase</button>}{(r.status === "submitted") && <><button className="btn ghost small" onClick={async () => { await api(`/api/timesheets/${r.id}/review`, { method: "POST", body: {} }); load(); }}>Review</button><button className="btn ghost small" onClick={async () => { await api(`/api/timesheets/${r.id}/approve`, { method: "POST", body: {} }); setMsg(`Timesheet approved for ${r.manager} ✓ — it can now be exported to payroll`); load(); }}>Approve</button><button className="btn ghost small" onClick={async () => { const reason = prompt("Reject this timesheet — reason (goes back to the submitter):"); if (!reason) return; await api(`/api/timesheets/${r.id}/reject`, { method: "POST", body: { reason } }); load(); }}>Reject</button></>}{(r.status === "reviewed") && <><button className="btn ghost small" onClick={async () => { await api(`/api/timesheets/${r.id}/approve`, { method: "POST", body: {} }); setMsg(`Timesheet approved for ${r.manager} ✓`); load(); }}>Approve</button><button className="btn ghost small" onClick={async () => { const reason = prompt("Reject this timesheet — reason:"); if (!reason) return; await api(`/api/timesheets/${r.id}/reject`, { method: "POST", body: { reason } }); load(); }}>Reject</button></>}<button className="btn ghost small" onClick={() => startEdit(r)}>{["submitted", "reviewed"].includes(r.status) ? "Edit" : "Log hours"}</button></span>
        {editId === r.id && <div style={{ marginTop: 8 }}><div className="rowflex">{dayNames.map(([k, lab]) => <label key={k} style={{ fontSize: 12 }}>{lab}<input type="number" min="0" max="24" style={{ width: 58, display: "block" }} value={days[k] ?? ""} onChange={e => setDays({ ...days, [k]: e.target.value === "" ? "" : Number(e.target.value) })} /></label>)}<b style={{ alignSelf: "end", paddingBottom: 8 }}>Σ {dayNames.reduce((a, [k]) => a + (Number(days[k]) || 0), 0)}h</b></div>
          <input placeholder="Notes (jobs covered, PTO, etc.)" value={notes} onChange={e => setNotes(e.target.value)} style={{ marginTop: 6 }} />
          <div className="rowflex" style={{ marginTop: 6 }}><button className="btn small" onClick={() => save(r)}>Save timesheet</button><button className="btn ghost small" onClick={() => setEditId("")}>Cancel</button></div></div>}</td></tr>)}
      {data.rows.length === 0 && <tr><td colSpan={6} className="muted">No field managers (PM / Lead Owner roles) in this workspace yet.</td></tr>}
    </tbody></table></>}
  </div>);
}

const [d, setD] = useState<any>(null); const [inbox, setInbox] = useState<any[]>([]);
  const load = () => { api("/api/ops").then(setD).catch(() => {}); api("/api/inbox").then(setInbox).catch(() => {}); };
  useEffect(load, []);
  if (!d) return <p className="muted">Loading ops…</p>;
  const chase = async (kind: string, id: string) => { await api(`/api/${kind}/${id}/submit`, { method: "POST", body: {} }); load(); };
  return (<div><h2 className="pt">Ops Console</h2><p className="sub">The daily chase, in one place: field reports, timesheets, site visits, paperwork, and the full inbox (not just leads).</p>
    <div className="grid2">
      {/* field reports moved below as full-width card */}
      {/* timesheets moved below as full-width card */}
    </div>
    <div className="grid2">
      <div className="card"><h3>Site visits</h3>{d.site_visits.map((v: any) => <p key={v.id} style={{ margin: "6px 0" }}>📍 {v.service_requested} — {dt(v.scheduled_at)} · {v.status}</p>)}{d.site_visits.length === 0 && <p className="muted">None scheduled.</p>}</div>
      <div className="card"><h3>Documents tracker</h3>{d.documents.map((doc: any) => <div className="check" key={doc.id}><span className={`st ${doc.status === "received" ? "pass" : "fail"}`}>{doc.status === "received" ? "✓" : "✗"}</span><span>{doc.name} — {doc.status}{doc.required ? " (required)" : ""}</span></div>)}</div>
    </div>
    <FieldReportsCard />
    <ScheduleCard />
    <TimesheetsCard />
    <TimeGridCard />
    <InboxQueue inbox={inbox} reload={load} />
  </div>);

}

function AccessModal({ member, close, done }: any) {
  const [p, setP] = useState<any>({ ...member.permissions }); const [limit, setLimit] = useState(member.approval_limit || 0); const [err, setErr] = useState("");
  const T2 = ({ k, label, hint }: any) => <label className="check" style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "7px 0", borderBottom: "1px solid #eef2f7" }}><input type="checkbox" style={{ width: "auto", marginTop: 2 }} checked={!!p[k]} onChange={e => setP({ ...p, [k]: e.target.checked })} /><span><b>{label}</b><br /><span className="muted">{hint}</span></span></label>;
  const save = async () => { try { await api(`/api/team/${member.id}`, { method: "PATCH", body: { permissions: p, approval_limit: Number(limit) || 0 } }); done(); } catch (e: any) { setErr(e.message); } };
  return (<div className="modalWrap"><div className="modal" style={{ maxWidth: 520 }}>
    <div className="rowflex" style={{ justifyContent: "space-between" }}><h3 style={{ margin: 0 }}>Access — {member.name}</h3><button className="btn ghost small" onClick={close}>✕ Close</button></div>
    <p className="muted">Role: {member.role}. These restrictions apply on top of the role and are enforced by the server — not just hidden in the interface.</p>
    {err && <div className="err">{err}</div>}
    <label className="f">Which leads can they see?</label>
    <select value={p.leads_scope || "own"} onChange={e => setP({ ...p, leads_scope: e.target.value })}><option value="all">All leads in the business</option><option value="own">Only leads they own or PM</option></select>
    <div style={{ marginTop: 10 }}>
      <T2 k="can_approve" label="Can approve proposals" hint="Decide approval packets (still bounded by their approval limit below)." />
      <T2 k="can_billing" label="Can see billing" hint="Subscription, plan and invoices. Money screens stay owner-only unless this is on." />
      <T2 k="can_settings" label="Can change settings" hint="Workspace settings, price book, templates, services and integrations." />
      <T2 k="can_export" label="Can export reports" hint="Download CSV exports from Reports." />
      <T2 k="can_manage_team" label="Can manage team access" hint="Change other members' roles and restrictions. Powerful — grant sparingly." />
    </div>
    <label className="f" style={{ marginTop: 12 }}>Approval limit ($) — proposals above this need a higher approver</label>
    <input type="number" value={limit} onChange={e => setLimit(e.target.value)} />
    <div className="rowflex" style={{ marginTop: 14 }}><button className="btn" onClick={save}>Save access</button>
      <button className="btn ghost" onClick={async () => { try { await api(`/api/team/${member.id}`, { method: "PATCH", body: { permissions: {} } }); done(); } catch (e: any) { setErr(e.message); } }}>Reset to role defaults</button></div>
  </div></div>);
}

function RatesTab({ users, refreshUsers }: any) {
  const [classes, setClasses] = useState<any[]>([]); const [msg, setMsg] = useState("");
  const [nc, setNc] = useState<any>({ name: "", private_rate: "", govt_rate: "" });
  const load = () => { api("/api/labor-classes").then(setClasses).catch(() => {}); };
  useEffect(load, []);
  const saveRow = async (c: any) => { await api("/api/labor-classes/" + c.id, { method: "PATCH", body: { name: c.name, private_rate: Number(c.private_rate) || 0, govt_rate: Number(c.govt_rate) || 0 } }); setMsg(`Saved ${c.name} ✓`); load(); };
  return (<div className="card"><h3 style={{ marginTop: 0 }}>Labor rates — private vs government (prevailing wage)</h3>
    <p className="muted">Each worker belongs to a class. When time is logged on a job, the rate comes from the class — the <b>private</b> column for private jobs, the <b>government</b> column for government/prevailing-wage jobs (set per job on its Crew & Time tab). Rates snapshot onto each entry, so raising rates later never changes old jobs' costs.</p>
    {msg && <div className="ok">{msg}</div>}
    {classes.length === 0 && <button className="btn" onClick={async () => { const r = await api("/api/labor-classes/seed-defaults", { method: "POST", body: {} }); setClasses(r); setMsg("Standard classes loaded — adjust the numbers to your payroll ✓"); }}>Load standard classes (Laborer / Technician / Foreman / PM)</button>}
    <table><thead><tr><th>Class</th><th>Private $/hr</th><th>Government $/hr</th><th></th></tr></thead><tbody>
      {classes.map((c: any, i: number) => <tr key={c.id}><td><input value={c.name} onChange={e => { const n = [...classes]; n[i] = { ...c, name: e.target.value }; setClasses(n); }} /></td>
        <td><input type="number" min="0" step="0.5" style={{ width: 100 }} value={c.private_rate} onChange={e => { const n = [...classes]; n[i] = { ...c, private_rate: e.target.value }; setClasses(n); }} /></td>
        <td><input type="number" min="0" step="0.5" style={{ width: 100 }} value={c.govt_rate} onChange={e => { const n = [...classes]; n[i] = { ...c, govt_rate: e.target.value }; setClasses(n); }} /></td>
        <td><span className="rowflex"><button className="btn ghost small" onClick={() => saveRow(c)}>Save</button><button className="btn ghost small" onClick={async () => { await api("/api/labor-classes/" + c.id, { method: "DELETE" }); load(); refreshUsers(); }}>Delete</button></span></td></tr>)}
    </tbody></table>
    <div className="rowflex" style={{ marginTop: 8 }}><input placeholder="New class name" value={nc.name} onChange={e => setNc({ ...nc, name: e.target.value })} /><input type="number" placeholder="Private $/hr" style={{ width: 110 }} value={nc.private_rate} onChange={e => setNc({ ...nc, private_rate: e.target.value })} /><input type="number" placeholder="Govt $/hr" style={{ width: 110 }} value={nc.govt_rate} onChange={e => setNc({ ...nc, govt_rate: e.target.value })} /><button className="btn ghost small" onClick={async () => { if (!nc.name) return; await api("/api/labor-classes", { method: "POST", body: { name: nc.name, private_rate: Number(nc.private_rate) || 0, govt_rate: Number(nc.govt_rate) || 0 } }); setNc({ name: "", private_rate: "", govt_rate: "" }); load(); }}>Add class</button></div>
    <h4 style={{ marginTop: 18 }}>Who belongs to which class</h4>
    <table><thead><tr><th>Team member</th><th>Role</th><th>Labor class</th></tr></thead><tbody>
      {users.map((u: any) => <tr key={u.id}><td>{u.name}</td><td>{u.role}</td><td><select value={u.labor_class_id || ""} onChange={async e => { await api("/api/team/" + u.id, { method: "PATCH", body: { labor_class_id: e.target.value || null } }); setMsg(`Class updated for ${u.name} ✓`); refreshUsers(); }}><option value="">— No class (time costs $0) —</option>{classes.map((c: any) => <option key={c.id} value={c.id}>{c.name} ({money(c.private_rate)} priv · {money(c.govt_rate)} govt)</option>)}</select></td></tr>)}
    </tbody></table>
  </div>);
}

function Settings({ users, setUsers, priceBook, setPriceBook, onJump, me }: any) {
  const myPerms = me?.permissions; const canSettings = !myPerms || myPerms.can_settings; const canTeam = !myPerms || myPerms.can_manage_team;
  const [accessFor, setAccessFor] = useState<any>(null);
  const [tab, setTab] = useState("workspace");
  const [s, setS] = useState<any>(null); const [msg, setMsg] = useState("");
  const [tpls, setTpls] = useState<any[]>([]); const [svcs, setSvcs] = useState<any[]>([]);
  const [keys, setKeys] = useState<any[]>([]); const [newKey, setNewKey] = useState(""); const [hooks, setHooks] = useState<any[]>([]); const [flags, setFlags] = useState<any>({}); const [oauth, setOauth] = useState<any>(null); const [catalog, setCatalog] = useState<any[]>([]); const [cfg, setCfg] = useState<string | null>(null); const [cfgMsg, setCfgMsg] = useState(""); const [syncRange, setSyncRange] = useState("30");
  useEffect(() => { api("/api/integrations").then(r => setCatalog(r.integrations)).catch(() => {}); }, []);
  const [nb, setNb] = useState<any>({ name: "", unit: "job", standard_price: "", floor_price: "" });
  const [pb, setPb] = useState<any[]>([]); useEffect(() => { setPb(priceBook); }, [priceBook]);
  const [tplEdit, setTplEdit] = useState<any>(null);
  const [nt, setNt] = useState<any>({ name: "", body: "" }); const [nu, setNu] = useState<any>({ name: "", email: "", role: "LEAD_OWNER", password: "" }); const [nh, setNh] = useState("");
  const loadAll = () => { api("/api/settings").then(setS).catch(() => {}); api("/api/templates").then(setTpls).catch(() => {}); api("/api/services").then(setSvcs).catch(() => {}); api("/api/api-keys").then(setKeys).catch(() => {}); api("/api/webhooks").then(setHooks).catch(() => {}); api("/api/flags").then(setFlags).catch(() => {}); api("/api/oauth/status").then(setOauth).catch(() => {}); api("/api/users").then(setUsers).catch(() => {}); api("/api/price-book").then(setPriceBook).catch(() => {}); };
  useEffect(loadAll, []);
  const T = ({ id, children }: any) => <button className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{children}</button>;
  return (<div><h2 className="pt">Settings</h2><p className="sub">Everything configurable, in the product — no engineer required.</p>
    {msg && <div className="ok">{msg}</div>}
    <div className="tabs">{canSettings && <><T id="workspace">Workspace</T><T id="pricebook">Price Book</T><T id="templates">Templates</T><T id="services">Services</T></>}{canTeam && <T id="team">Team</T>}{canSettings && <T id="workers">Workers</T>}{canSettings && <T id="rates">Labor & Rates</T>}{canSettings && <T id="rules">Inbox Rules</T>}{canSettings && <T id="cfields">Custom Fields</T>}{canSettings && <T id="assign">Assignment</T>}{canSettings && <T id="integrations">Integrations</T>}{me?.permissions?.can_billing && <T id="billing">Billing</T>}</div>
    {tab === "billing" && <Billing />}
    {!canSettings && !canTeam && <div className="card">Your access doesn't include settings or team management. Ask an owner or admin if you need something changed.</div>}
    {tab === "workspace" && canSettings && s && <div className="card"><div className="formgrid">
      <div><label className="f">Business name</label><input value={s.workspace.name || ""} onChange={e => setS({ ...s, workspace: { ...s.workspace, name: e.target.value } })} /></div>
      <div><label className="f">Vertical</label><input value={s.workspace.vertical || ""} onChange={e => setS({ ...s, workspace: { ...s.workspace, vertical: e.target.value } })} /></div>
      <div><label className="f">Timezone</label><input value={s.workspace.timezone || ""} onChange={e => setS({ ...s, workspace: { ...s.workspace, timezone: e.target.value } })} /></div>
      <div><label className="f">Deposit % on signed proposals</label><input type="number" value={s.workspace.deposit_pct ?? 25} onChange={e => setS({ ...s, workspace: { ...s.workspace, deposit_pct: Number(e.target.value) } })} /></div>
      <div><label className="f">Autonomy level (1 draft-only · 2 bulk-approve · 3 scoped auto)</label><select value={s.workspace.autonomy_level ?? 1} onChange={e => setS({ ...s, workspace: { ...s.workspace, autonomy_level: Number(e.target.value) } })}><option value={1}>1 — draft only</option><option value={2}>2 — bulk approve</option><option value={3}>3 — scoped auto-approval</option></select></div>
      <div><label className="f">Proposal approval policy</label><select value={s.workspace.approval_policy || "amount"} onChange={e => setS({ ...s, workspace: { ...s.workspace, approval_policy: e.target.value } })}><option value="off">Off — send freely, no approvals</option><option value="amount">By amount — approve only above the threshold</option><option value="always">Always — every proposal needs approval before sending</option></select></div>
      <div><label className="f">Approval threshold ($)</label><input type="number" value={s.workspace.approval_threshold ?? 25000} onChange={e => setS({ ...s, workspace: { ...s.workspace, approval_threshold: Number(e.target.value) } })} /></div>
      <div><label className="f">Counts</label><p className="muted">{num(s.counts.leads)} leads · {num(s.counts.users)} users · {num(s.counts.price_items)} price items</p></div>
      <div><label className="f">Lead source API URL (for Sync)</label><input value={s.workspace.source_api_url || ""} placeholder="Leave blank to use the built-in demo source" onChange={e => setS({ ...s, workspace: { ...s.workspace, source_api_url: e.target.value } })} /></div>
      <div><label className="f">Sender name (outgoing email)</label><input value={s.workspace.from_name || ""} placeholder="Your business name" onChange={e => setS({ ...s, workspace: { ...s.workspace, from_name: e.target.value } })} /></div>
      <div><label className="f">Sender email (outgoing email)</label><input value={s.workspace.from_email || ""} placeholder="you@yourbusiness.com" onChange={e => setS({ ...s, workspace: { ...s.workspace, from_email: e.target.value } })} /></div>
      <div><label className="f">Slack webhook URL (new-lead + approval alerts)</label><input value={s.workspace.slack_webhook_url || ""} placeholder="https://hooks.slack.com/services/…" onChange={e => setS({ ...s, workspace: { ...s.workspace, slack_webhook_url: e.target.value } })} /></div>
      <div><label className="f">Lead source API key (if required)</label><input value={s.workspace.source_api_key || ""} placeholder="Bearer key for your source system" onChange={e => setS({ ...s, workspace: { ...s.workspace, source_api_key: e.target.value } })} /></div>
    </div><button className="btn" style={{ marginTop: 14 }} onClick={async () => { await api("/api/settings", { method: "PATCH", body: s.workspace }); setMsg("Workspace settings saved ✓"); }}>Save workspace</button></div>}
    {tab === "workspace" && canSettings && s && <FollowupSettings key={s.workspace.id} ws={s.workspace} />}
    {tab === "workspace" && <div className="card"><h3 style={{ marginTop: 0 }}>Help & shortcuts</h3><p className="muted" style={{ margin: "4px 0" }}>⌘K — jump anywhere · J/K — move in the Work Queue · Enter — open · The free Backlog Audit lives at <a href="/audit" target="_blank" rel="noreferrer">/audit</a> (share it with prospects). Support: reply to any Workpile email or write to the workspace owner. Every number in this app traces to a record — click through instead of screenshotting.</p></div>}
    {tab === "workspace" && canSettings && s && <BookingSettings key={"bk" + s.workspace.id} ws={s.workspace} />}
    {tab === "pricebook" && canSettings && <div className="card"><table><thead><tr><th>Item</th><th>Unit</th><th>Standard</th><th>Floor</th><th></th></tr></thead><tbody>
      {pb.map((p: any, i: number) => <tr key={p.id}><td>{p.name}</td><td>{p.unit}</td><td><input type="number" min="0" step="0.5" style={{ width: 110 }} value={p.standard_price} onChange={e => { const n = [...pb]; n[i] = { ...p, standard_price: e.target.value }; setPb(n); }} /></td><td><input type="number" min="0" step="0.5" style={{ width: 110 }} value={p.floor_price} onChange={e => { const n = [...pb]; n[i] = { ...p, floor_price: e.target.value }; setPb(n); }} /></td><td><button className="btn ghost small" onClick={async () => { await api(`/api/price-book/${p.id}`, { method: "PATCH", body: { standard_price: Number(p.standard_price) || 0, floor_price: Number(p.floor_price) || 0 } }); setMsg("Price saved ✓"); loadAll(); }}>Save</button> <button className="btn ghost small" onClick={async () => { await api(`/api/price-book/${p.id}`, { method: "DELETE" }); loadAll(); }}>Delete</button></td></tr>)}
    </tbody></table>
      <div className="rowflex" style={{ marginTop: 12 }}><input style={{ flex: 2 }} placeholder="New item name" value={nb.name} onChange={e => setNb({ ...nb, name: e.target.value })} /><input style={{ width: 90 }} placeholder="unit" value={nb.unit} onChange={e => setNb({ ...nb, unit: e.target.value })} /><input style={{ width: 120 }} type="number" placeholder="standard $" value={nb.standard_price} onChange={e => setNb({ ...nb, standard_price: e.target.value })} /><input style={{ width: 120 }} type="number" placeholder="floor $" value={nb.floor_price} onChange={e => setNb({ ...nb, floor_price: e.target.value })} /><button className="btn" onClick={async () => { await api("/api/price-book", { method: "POST", body: { ...nb, standard_price: Number(nb.standard_price) || 0, floor_price: Number(nb.floor_price) || 0 } }); setNb({ name: "", unit: "job", standard_price: "", floor_price: "" }); loadAll(); }}>Add item</button></div>
      <p className="muted">Proposals can only price from this book — the floor is the margin guardrail the Approval Gate enforces.</p></div>}
    {tab === "templates" && canSettings && <div className="card"><VerticalPacksCard /><DocTemplatesEditor /><h3>Message templates</h3>{tpls.map(t => <div key={t.id} style={{ borderBottom: "1px solid #eef2f7", padding: "10px 0" }}><b>{t.name}</b> <span className="muted">· {t.kind} · v{t.version} · {t.active ? "active" : "inactive"}</span>{tplEdit?.id === t.id ? <><textarea rows={5} value={tplEdit.body} onChange={e => setTplEdit({ ...tplEdit, body: e.target.value })} /><span className="rowflex" style={{ marginTop: 6 }}><button className="btn small" onClick={async () => { await api(`/api/templates/${t.id}`, { method: "PATCH", body: { body: tplEdit.body } }); setTplEdit(null); loadAll(); }}>Save</button><button className="btn ghost small" onClick={() => setTplEdit(null)}>Cancel</button></span></> : <><p className="muted" style={{ whiteSpace: "pre-wrap" }}>{t.body}</p><button className="btn ghost small" onClick={() => setTplEdit({ id: t.id, body: t.body })}>Edit</button></>} <button className="btn ghost small" onClick={async () => { await api(`/api/templates/${t.id}`, { method: "DELETE" }); loadAll(); }}>Delete</button></div>)}
      <div className="formgrid" style={{ marginTop: 12 }}><div><label className="f">New template name</label><input value={nt.name} onChange={e => setNt({ ...nt, name: e.target.value })} /></div><div className="full"><label className="f">Body (merge fields: {"{{contact_name}} {{service}} {{total}}"})</label><textarea rows={4} value={nt.body} onChange={e => setNt({ ...nt, body: e.target.value })} /></div></div>
      <button className="btn" style={{ marginTop: 10 }} onClick={async () => { await api("/api/templates", { method: "POST", body: nt }); setNt({ name: "", body: "" }); loadAll(); }}>Add template</button></div>}
    {tab === "services" && canSettings && <div className="card">{svcs.map(sv => <div className="check" key={sv.id}><span className={`st ${sv.active ? "pass" : "fail"}`}>{sv.active ? "✓" : "✗"}</span><span style={{ flex: 1 }}>{sv.name} {sv.is_catalog ? "" : "(not in catalog — Demand Gap territory)"}</span><button className="btn ghost small" onClick={async () => { await api(`/api/services/${sv.id}`, { method: "PATCH", body: { active: !sv.active } }); loadAll(); }}>{sv.active ? "Deactivate" : "Activate"}</button></div>)}
      <div className="rowflex" style={{ marginTop: 10 }}><input style={{ flex: 1 }} placeholder="New service name" id="nsvc" /><button className="btn" onClick={async () => { const el = document.getElementById("nsvc") as HTMLInputElement; await api("/api/services", { method: "POST", body: { name: el.value } }); el.value = ""; loadAll(); }}>Add service</button></div></div>}
    {tab === "team" && canTeam && <div className="card"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Approval limit</th><th></th></tr></thead><tbody>
      {users.map((u: any) => <tr key={u.id}><td>{u.name}{u.has_overrides ? <span className="tinyBadge" style={{ marginLeft: 6, background: "#fef9c3", color: "#854d0e" }}>custom access</span> : null}</td><td>{u.email}</td><td><select value={u.role} onChange={async e => { await api(`/api/team/${u.id}`, { method: "PATCH", body: { role: e.target.value } }); loadAll(); }}><option>OWNER</option><option>APPROVER</option><option>OPS_ADMIN</option><option>LEAD_OWNER</option><option>PM</option><option>ADMIN</option></select></td><td>{u.role === "OWNER" ? <b style={{ color: "#14532d" }}>Unlimited</b> : money(u.approval_limit)}</td><td>{u.role === "OWNER" ? <span className="muted">Full access</span> : <button className="btn ghost small" onClick={() => setAccessFor(u)}>Access…</button>}</td></tr>)}
    </tbody></table>
      <div className="rowflex" style={{ marginTop: 12 }}><input style={{ flex: 1 }} placeholder="Name" value={nu.name} onChange={e => setNu({ ...nu, name: e.target.value })} /><input style={{ flex: 1 }} placeholder="Email" value={nu.email} onChange={e => setNu({ ...nu, email: e.target.value })} /><input style={{ flex: 1 }} placeholder="Temp password" value={nu.password} onChange={e => setNu({ ...nu, password: e.target.value })} /><select style={{ width: 150 }} value={nu.role} onChange={e => setNu({ ...nu, role: e.target.value })}><option>LEAD_OWNER</option><option>PM</option><option>APPROVER</option><option>OPS_ADMIN</option></select><button className="btn" onClick={async () => { await api("/api/users", { method: "POST", body: nu }); setNu({ name: "", email: "", role: "LEAD_OWNER", password: "" }); loadAll(); setMsg("Team member added ✓"); }}>Add member</button></div>
      {accessFor && <AccessModal member={accessFor} close={() => setAccessFor(null)} done={() => { setAccessFor(null); loadAll(); setMsg("Access updated ✓"); }} />}</div>}
    {tab === "rates" && canSettings && <RatesTab users={users} refreshUsers={loadAll} />}
    {tab === "workers" && canSettings && <WorkersTab />}
    {tab === "rules" && canSettings && <InboxRulesTab users={users} />}
    {tab === "cfields" && canSettings && <CustomFieldsTab />}
    {tab === "assign" && canSettings && <AssignmentRulesTab users={users} />}
    {tab === "integrations" && canSettings && <div>
      <div className="card"><h3 style={{ marginTop: 0 }}>Integration catalog — every way data moves in and out</h3>
      <div className="featGrid">{catalog.map((c: any) => <div className="feat clickable" key={c.id} onClick={() => { setCfg(c.id); setCfgMsg(""); }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><b>{c.name}</b><span className="tinyBadge" style={c.status === "connected" ? { background: "#dcfce7", color: "#166534" } : c.status === "test_mode" || c.status === "demo_source" ? { background: "#fef9c3", color: "#854d0e" } : {}}>{c.status.replaceAll("_", " ")}</span></div><p>{c.detail}</p><span className="cfgHint">Configure →</span></div>)}</div></div>
      <div className="card"><h3>API keys</h3>{keys.map(k => <p key={k.id} className="muted" style={{ margin: "6px 0" }}>{k.label} · scopes {k.scopes} · {k.revoked_at ? "revoked" : "active"} {k.revoked_at ? "" : <button className="btn ghost small" onClick={async () => { await api(`/api/api-keys/${k.id}`, { method: "DELETE" }); loadAll(); }}>Revoke</button>}</p>)}
        <button className="btn" onClick={async () => { const r = await api("/api/api-keys", { method: "POST", body: { label: "Integration key" } }); setNewKey(r.key); loadAll(); }}>Generate new key</button>
        {newKey && <p className="mono ok">New key (shown once): {newKey}</p>}
        <p className="muted">Your system pulls finals from <span className="mono">GET /v1/outcomes</span> and acknowledges with <span className="mono">POST /v1/outcomes/:id/ack</span>. Push alternative: webhooks below.</p></div>
      <div className="card"><h3>Webhook endpoints (signed, HMAC)</h3>{hooks.map(h => <p key={h.id} className="muted" style={{ margin: "6px 0" }}><span className="mono">{h.url}</span> · {h.events} · {h.active ? "active" : "off"} <button className="btn ghost small" onClick={async () => { await api(`/api/webhooks/${h.id}`, { method: "DELETE" }); loadAll(); }}>Disable</button></p>)}
        <div className="rowflex"><input style={{ flex: 1 }} placeholder="https://your-system.example/webhooks/workpile" value={nh} onChange={e => setNh(e.target.value)} /><input style={{ flex: 1 }} placeholder="Events (comma list or *)" id="nhev" defaultValue="lead.created,lead.state_changed,approval.decided,proposal.signed,deposit.paid,outcome.final" /><button className="btn" onClick={async () => { await api("/api/webhooks", { method: "POST", body: { url: nh, events: (document.getElementById("nhev") as HTMLInputElement).value } }); setNh(""); loadAll(); }}>Add endpoint</button></div></div>
      <div className="card"><h3 style={{ marginTop: 0 }}>API quick reference — {location.origin}</h3>
      <div className="tableWrap"><table><thead><tr><th>Method</th><th>Endpoint</th><th>What it does</th><th>Scope</th></tr></thead><tbody>
      {[["POST", "/v1/leads", "Create a lead — idempotent, deduped by phone/email", "leads:write"], ["GET", "/v1/leads", "List leads (filter by state)", "leads:read"], ["GET", "/v1/leads/:id", "Read one lead", "leads:read"], ["POST", "/v1/leads/:id/outcome", "Push a final outcome BACK into Workpile", "outcomes:write"], ["POST", "/v1/inbox", "Send an email/message for AI triage", "leads:write"], ["GET", "/v1/outcomes", "Pull final outcomes for your system", "outcomes:read"], ["POST", "/v1/outcomes/:id/ack", "Acknowledge with your system's ID", "outcomes:read"], ["GET", "/v1/projects/:leadId", "Won lead's full project package", "projects:read"]].map(r => <tr key={r[1] + r[0]}><td><b>{r[0]}</b></td><td><code>{r[1]}</code></td><td>{r[2]}</td><td>{r[3]}</td></tr>)}
      </tbody></table></div>
      <p className="muted">Full machine-readable spec: <a href="/openapi.json" target="_blank">{location.host}/openapi.json</a> · Webhooks are HMAC-signed (<code>X-Workpile-Signature</code>) and only marked delivered on a real 2xx from your endpoint. Zapier, Make, and n8n connect through this same API + webhooks today.</p></div>
      <div className="card"><h3>Inbox connections</h3><p className="muted">Gmail: {oauth?.google?.configured ? "app configured" : "not configured on this deployment"} · Outlook: {oauth?.microsoft?.configured ? "app configured" : "not configured"}. Manual/API/CSV ingestion works regardless.</p>
        <h3 style={{ marginTop: 16 }}>Feature flags (canary)</h3>{Object.entries(flags).map(([k, v]: any) => <div className="check" key={k}><span className={`st ${v ? "pass" : "fail"}`}>{v ? "✓" : "✗"}</span><span style={{ flex: 1 }}>{k.replaceAll("_", " ")}</span><button className="btn ghost small" onClick={async () => { await api("/api/flags", { method: "POST", body: { flag: k, enabled: !v } }); loadAll(); }}>{v ? "Turn off" : "Turn on"}</button></div>)}
        <h3 style={{ marginTop: 16 }}>Website form embed (captures TCPA consent automatically)</h3><p className="mono">&lt;script src="{location.origin}/embed/v1.js" data-workspace="YOUR_WORKSPACE" data-form="#lead-form"&gt;&lt;/script&gt;</p></div>
    </div>}
    {cfg && s && <IntegrationConfig id={cfg} s={s} setS={setS} keys={keys} hooks={hooks} oauth={oauth} loadAll={loadAll} onJump={onJump} msg={cfgMsg} setMsg={setCfgMsg} syncRange={syncRange} setSyncRange={setSyncRange} close={() => setCfg(null)} />}
  </div>);
}


const GUIDES: Record<string, { steps: string[]; code?: string }> = {
  email_sending: { steps: [
    "Set your sender name and email below — use an address on YOUR domain (e.g. proposals@yourcompany.com). Every email the app sends then comes from you, not from Workpile.",
    "Your domain must be verified with the email provider (Resend) before live delivery: tell Workpile support the domain and we add it to the sending account, then hand you 3 DNS records (DKIM + SPF/return-path).",
    "Paste those records at your domain registrar (GoDaddy, Cloudflare, Namecheap — wherever DNS lives). Records are one-time, take ~5 minutes, and verify within minutes to a few hours.",
    "Add a DMARC record too (TXT _dmarc → v=DMARC1; p=none;) — it is what keeps your mail out of spam folders at Gmail/Outlook.",
    "Until the domain verifies, sends run in TEST MODE: composed, recorded, honestly labeled — never silently 'sent'. Once verified, the same screens send live with no other change.",
    "Custom sending domains are a Pro-plan feature. Replies land in your real mailbox because the From address is yours — also set your company inbox up in the Inbox guides so replies get triaged here."] },
  slack: { steps: [
    "In Slack, go to api.slack.com/apps → Create New App → From scratch. Name it 'Workpile' and pick your workspace.",
    "In the app settings open 'Incoming Webhooks' and switch it ON.",
    "Click 'Add New Webhook to Workspace', choose the channel that should get alerts (e.g. #new-leads), and Allow.",
    "Copy the webhook URL — it looks like https://hooks.slack.com/services/T…/B…/…",
    "Paste it into the field below, click Save, then 'Send test message'. A Workpile test post should appear in the channel within seconds.",
    "Alerts fire on new leads and approval decisions. If the test 404s, the webhook was deleted or regenerated in Slack — create a fresh one and re-paste."] },
  quickbooks: { steps: [
    "Honest status: a native one-click QuickBooks connect is NOT live yet. It needs Workpile's Intuit developer app approved (a platform task on our side) — we will not show you a fake Connect button.",
    "What works today — option 1, Zapier/Make: create a Zap 'Webhooks by Zapier (Catch Hook) → QuickBooks Online: Create Customer / Create Invoice'. In Settings → Integrations → Webhooks, point an endpoint at your Zap URL with events proposal.signed and deposit.paid.",
    "Option 2, CSV: Reports exports invoices and payments as CSV; QuickBooks imports them via Settings → Import Data. Five minutes a week for most shops.",
    "Everything QuickBooks would receive already exists here as real data: invoices with numbers, balances, and payments (Jobs → Invoices), so the day native connect lands, history syncs cleanly."] },
  rest_api: { steps: [
    "Generate an API key below (or in the API keys card). It is shown ONCE — store it in your system's secret manager.",
    "WordPress: either drop the Website Form Embed script into your theme footer (no plugin needed), or keep your form plugin (Contact Form 7 / WPForms / Gravity Forms) and add its webhook add-on pointed at the endpoint below with header 'Authorization: Bearer YOUR_KEY'.",
    "React / Next / any website: send the fetch call below from your form handler — server-side is best so the key never ships to browsers; for public forms use the Embed instead.",
    "Payloads are idempotent and deduped by phone/email, so retries and double-submits never create twins.",
    "Test it: submit one real form entry, then check Leads — it should appear within seconds with source = your system."],
    code: 'POST ORIGIN/v1/leads\nAuthorization: Bearer YOUR_API_KEY\nContent-Type: application/json\n\n{ "contact": { "name": "Pat Lee", "email": "pat@example.com", "phone": "+15165550199" },\n  "service_requested": "Roofing quote", "est_value": 3200, "message": "From the website form" }' },
  sync: { steps: [
    "In your current system (CRM, lead provider, spreadsheet app), find its API or export endpoint that returns leads as a JSON array.",
    "Paste that URL below as the Source API URL, plus its API key if it needs one (sent as a Bearer token).",
    "Click Run sync (7/30/90 days) — Workpile pulls, dedupes by phone/email, and reports fetched / created / duplicates.",
    "Happy with the result? Tick 'Daily auto-sync' and it repeats every night. Your old system stays untouched — this is read-only pull."] },
  csv: { steps: [
    "Export from anywhere — Excel, Google Sheets, Jobber, Housecall Pro, ServiceTitan, Salesforce — as a .csv file.",
    "Keep the header row: name, phone, email, service, value, location are auto-mapped; vendor exports import as-is using the preset on the Import page (no Excel surgery).",
    "Import 10 test rows first and check the created/duplicates counts before doing the full file.",
    "Bulk imports skip duplicates by phone/email instead of overwriting — existing customers are never clobbered.",
    "After the import, open Import → Backlog health: score everything, archive duplicate/spam rows, and let the agent start working the hot band."] },
  embed: { steps: [
    "Copy the script tag in the Inbox connections card below and paste it just before </body> on the pages with your lead form (WordPress: a header/footer plugin or your theme).",
    "Set data-workspace to your workspace ID (shown in Settings → Workspace) and data-form to your form's CSS selector, e.g. #lead-form or form.quote.",
    "Submissions post straight into Workpile with the TCPA consent text captured on the record — required for legal texting later.",
    "Submit a test entry and watch it land in Leads. No key is exposed: the embed is public-safe by design."] },
  email_in: { steps: [
    "Any system that can send an HTTP POST can put mail in this inbox: POST to the endpoint below with your API key; every message is AI-triaged into a lead or an owned item.",
    "For a company mailbox (Gmail / Outlook / any IMAP inbox), the live-sync recipe that works TODAY is in the Gmail + Outlook guide — a Zapier/Make automation that forwards each new email here.",
    "Historical mail: use Import → Email backlog (step 2 on the Import page) with an .mbox export — thousands of messages triaged in one drop."],
    code: 'POST ORIGIN/v1/inbox\nAuthorization: Bearer YOUR_API_KEY\nContent-Type: application/json\n\n{ "from_email": "customer@example.com", "from_name": "Pat Lee",\n  "subject": "Quote request", "body": "…the email text…" }' },
  gmail_outlook: { steps: [
    "Where it stands, honestly: the one-click OAuth connect flow is built, but two platform pieces remain — Workpile must register its Google/Microsoft apps, and the mailbox poller activates with them. Until then the Connect button reports 'not configured' instead of pretending.",
    "Live sync that works TODAY (10 minutes, any company mailbox): in Zapier or Make, create: Trigger = Gmail (or Outlook) 'New Email' on your company inbox → Action = Webhooks 'POST' to the Email-In endpoint (see the Email-In API guide for the exact payload) with your Workpile API key.",
    "Every new company email then lands in the Inbox here within a minute or two — triaged, prioritized (hot/urgent rules), and assigned. Replies you send go out from your own domain via the Email Sending guide.",
    "History: Import page → Email backlog takes a full Gmail Takeout .mbox or Outlook export for everything already sitting in the mailbox.",
    "Prioritization is automatic once mail flows: proposal and active-job mail is HOT, urgent language or overdue follow-ups become URGENT, and anything hot waiting too long ESCALATES to the owners with a bell alert."] },
  zapier_make: { steps: [
    "Inbound (anything → Workpile): Zapier/Make trigger of your choice → Webhooks action → POST to the REST API endpoint with your API key (exact payload in the REST API guide).",
    "Outbound (Workpile → anything): add a Webhook endpoint below pointing at a Zapier 'Catch Hook' URL; pick events like lead.created, proposal.signed, deposit.paid.",
    "QuickBooks, Google Sheets, HubSpot, Mailchimp — all reachable through this bridge today, no waiting on native connectors.",
    "Verify signatures on inbound Workpile webhooks: events are HMAC-signed (X-Workpile-Signature / -V2 headers) — check them before acting on a payload."] },
  stripe: { steps: [
    "Stripe is platform-managed in Workpile: customer deposits (on signed proposals) and your Workpile subscription run through it — there is nothing for a workspace admin to configure.",
    "The status above shows test_mode until the deployment's live Stripe keys are in; the app labels every payment honestly (test vs live) everywhere it appears.",
    "Set your deposit percentage in Settings → Workspace. Payment links ride on the proposal the customer signs."] },
  webhooks: { steps: [
    "Add an endpoint URL below (HTTPS, must return a 2xx within a few seconds — anything else counts as not delivered and is retried honestly).",
    "List the events you want (comma separated, or * for all): lead.created, lead.state_changed, approval.decided, proposal.signed, deposit.paid, outcome.final.",
    "Verify the HMAC signature headers on every delivery before trusting the payload; the timestamped V2 signature is the current scheme.",
    "Deliveries are only marked delivered on a real 2xx from your server — check the endpoint's own logs if events seem missing."] },
  handoff: { steps: [
    "When a lead is Won, its full project package (scope, signed proposal, documents) is delivered to your system of record — via the REST API pull (GET /v1/projects/:leadId) or pushed by webhook.",
    "Your system acknowledges with POST /v1/outcomes/:id/ack carrying YOUR project ID, so both sides agree on identity.",
    "Lost and no-response finals are delivered the same way — the loop closes on every lead, not just wins."] },
};
function IntegrationConfig({ id, s, setS, keys, hooks, oauth, loadAll, onJump, msg, setMsg, syncRange, setSyncRange, close }: any) {
  if (!id) return null;
  const ws = s?.workspace || {};
  const saveSettings = async (patch: any) => { await api("/api/settings", { method: "PATCH", body: patch }); setMsg("Saved."); loadAll(); };
  const runSync = async (days: number) => { const to = new Date(); const from = new Date(Date.now() - days * 86400000); setMsg("Syncing…"); const r = await api("/api/sync/run", { method: "POST", body: { from: from.toISOString(), to: to.toISOString() } }); setMsg(`Sync done: ${r.fetched} fetched · ${r.created} created · ${r.duplicates} duplicates skipped.`); };
  const T: Record<string, string> = { rest_api: "REST API (two-way)", webhooks: "Event Webhooks", sync: "Lead Sync (pull)", csv: "CSV Import / Export", embed: "Website Form Embed", email_in: "Email-In API", gmail_outlook: "Gmail + Outlook", slack: "Slack Notifications", stripe: "Stripe", zapier_make: "Zapier / Make / n8n", handoff: "Final Outcome Handoff", email_sending: "Email Sending (your domain)", quickbooks: "QuickBooks" };
  return <div className="modalOverlay" onClick={close}><div className="modal" onClick={e => e.stopPropagation()}>
    <div className="modalHead"><h3 style={{ margin: 0 }}>Configure — {T[id] || id}</h3><button className="btn ghost small" onClick={close}>✕</button></div>
    {msg && <p className="ok">{msg}</p>}
    {GUIDES[id] && <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}><b>📖 Step-by-step setup</b><ol style={{ margin: "8px 0 4px", paddingLeft: 20, fontSize: 13.5, lineHeight: 1.55 }}>{GUIDES[id].steps.map((st: string, k: number) => <li key={k} style={{ margin: "3px 0" }}>{st}</li>)}</ol>{GUIDES[id].code && <pre style={{ background: "#0f172a", color: "#e2e8f0", borderRadius: 8, padding: "10px 12px", fontSize: 12, overflowX: "auto", whiteSpace: "pre-wrap" }}>{GUIDES[id].code!.replaceAll("ORIGIN", location.origin)}</pre>}</div>}
    {id === "email_sending" && <div><label className="f">Sender name (the "from" name customers see)</label><input value={ws.from_name || ""} placeholder={ws.name || "Your Company"} onChange={e => setS({ ...s, workspace: { ...ws, from_name: e.target.value } })} /><label className="f">Sender email — must be on your own domain</label><input value={ws.from_email || ""} placeholder="proposals@yourcompany.com" onChange={e => setS({ ...s, workspace: { ...ws, from_email: e.target.value } })} /><label className="f">Reply-to (optional) — where customer replies should land</label><input value={ws.reply_email || ""} placeholder="info@yourcompany.com" onChange={e => setS({ ...s, workspace: { ...ws, reply_email: e.target.value } })} /><p className="muted">Sending from a subdomain (e.g. proposals@send.yourcompany.com)? Set Reply-to to your real inbox so replies reach your mailbox, not the subdomain.</p><div className="rowflex" style={{ marginTop: 8 }}><button className="btn" onClick={() => saveSettings({ from_name: ws.from_name || "", from_email: ws.from_email || "", reply_email: ws.reply_email || "" })}>Save sender identity</button></div><p className="muted" style={{ marginTop: 8 }}>Status: {ws.from_email ? "sender set — live delivery starts the moment your domain verifies with the provider (steps above); until then sends are recorded as test mode, never faked." : "not set — mail currently goes out under the Workpile sender."}</p></div>}
    {id === "quickbooks" && <div><p className="muted">No fields here yet — deliberately. When the native connect ships, this panel becomes the OAuth connect + company picker. Until then the Zapier bridge (guide above) moves signed proposals and deposits into QuickBooks Online, and Reports CSV export covers the rest.</p></div>}
    {id === "rest_api" && <div><p className="muted">API keys authenticate your systems. Scopes: leads:write, leads:read, outcomes:read, outcomes:write, projects:read. Full spec: <a href="/openapi.json" target="_blank">/openapi.json</a></p>
      {keys.map((k: any) => <p key={k.id} className="muted" style={{ margin: "6px 0" }}>{k.label} · {k.scopes} · {k.revoked_at ? "revoked" : "active"} {k.revoked_at ? "" : <button className="btn ghost small" onClick={async () => { await api(`/api/api-keys/${k.id}`, { method: "DELETE" }); loadAll(); }}>Revoke</button>}</p>)}
      <button className="btn" onClick={async () => { const r = await api("/api/api-keys", { method: "POST", body: { label: "integration", scopes: "leads:write,leads:read,outcomes:read,outcomes:write,projects:read" } }); setMsg("New key (shown once): " + (r.key || r.raw_key || JSON.stringify(r))); loadAll(); }}>Generate new key</button></div>}
    {id === "webhooks" && <div><p className="muted">Endpoints receive HMAC-signed events (header <span className="mono">X-Workpile-Signature</span>). A delivery counts only on a real 2xx from your server.</p>
      {hooks.map((h: any) => <p key={h.id} className="muted" style={{ margin: "6px 0" }}>{h.url} · events: {h.events || "outcome.final"} · {h.active ? "active" : "paused"} <button className="btn ghost small" onClick={async () => { await api(`/api/webhooks/${h.id}`, { method: "DELETE" }); loadAll(); }}>Remove</button></p>)}
      <div className="rowflex"><input id="cfgHookUrl" style={{ flex: 1 }} placeholder="https://your-system.example/webhooks/workpile" /><input id="cfgHookEvents" style={{ flex: 1 }} defaultValue="lead.created,lead.state_changed,approval.decided,proposal.signed,deposit.paid,outcome.final" /></div>
      <button className="btn" style={{ marginTop: 8 }} onClick={async () => { await api("/api/webhooks", { method: "POST", body: { url: (document.getElementById("cfgHookUrl") as HTMLInputElement).value, events: (document.getElementById("cfgHookEvents") as HTMLInputElement).value } }); setMsg("Endpoint added."); loadAll(); }}>Add endpoint</button></div>}
    {id === "sync" && <div><p className="muted">Workpile pulls leads from your lead system's API by date range. Leave the URL empty to use the built-in demo source.</p>
      <label className="f">Source API URL</label><input value={ws.source_api_url || ""} placeholder="https://your-crm.example/api/leads" onChange={e => setS({ ...s, workspace: { ...ws, source_api_url: e.target.value } })} />
      <label className="f">Source API key (Bearer, if required)</label><input value={ws.source_api_key || ""} onChange={e => setS({ ...s, workspace: { ...ws, source_api_key: e.target.value } })} />
      <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "10px 0" }}><input type="checkbox" checked={!!ws.sync_enabled} onChange={e => setS({ ...s, workspace: { ...ws, sync_enabled: e.target.checked ? 1 : 0 } })} /> Daily auto-sync</label>
      <div className="rowflex" style={{ marginTop: 8 }}><button className="btn" onClick={() => saveSettings({ source_api_url: ws.source_api_url || "", source_api_key: ws.source_api_key || "", sync_enabled: !!ws.sync_enabled })}>Save sync settings</button></div>
      <label className="f">Run a sync now</label><div className="rowflex">{[["Today", 1], ["7 days", 7], ["30 days", 30], ["90 days", 90]].map(([label, d]: any) => <button key={label} className="btn ghost small" onClick={() => runSync(d)}>{label}</button>)}<span className="muted">{ws.last_sync_at ? "Last sync: " + ws.last_sync_at : "Never synced"}</span></div></div>}
    {id === "csv" && <div><p className="muted">Import a backlog CSV (name, phone, email, service, message, created date) — deduped by phone/email on the way in. Exports live in Reports.</p><button className="btn" onClick={() => onJump && onJump("imports")}>Open CSV Import →</button></div>}
    {id === "embed" && <div><p className="muted">Paste this on any website with a lead form. Consent (TCPA) is captured automatically with each submission.</p><p className="mono" style={{ wordBreak: "break-all" }}>{`<script src="${location.origin}/embed/v1.js" data-workspace="${ws.id || "YOUR_WORKSPACE"}" data-form="#lead-form"></script>`}</p><button className="btn" onClick={() => { navigator.clipboard?.writeText(`<script src="${location.origin}/embed/v1.js" data-workspace="${ws.id || ""}" data-form="#lead-form"></script>`); setMsg("Snippet copied."); }}>Copy snippet</button></div>}
    {id === "email_in" && <div><p className="muted">Send any email-shaped payload and the triage agent files it as a lead (with phone extraction) or an owned inbox item.</p><p className="mono">POST /v1/inbox · scope leads:write<br />{"{ from_name, from_email, subject, body, received_at }"}</p><p className="muted">Mailbox forwarding and Gmail/Outlook polling feed this same endpoint.</p></div>}
    {id === "gmail_outlook" && <div><p className="muted">Gmail: {oauth?.google?.configured ? "app configured" : "platform app credentials not set on this deployment"} · Outlook: {oauth?.microsoft?.configured ? "app configured" : "not configured"}</p><p className="muted">When the platform OAuth apps are configured, each workspace connects its mailbox here and polling feeds the Email-In triage pipeline. Until then, API/CSV/manual ingestion works fully.</p>{oauth?.google?.configured && <a className="btn" href="/api/oauth/google/start">Connect Gmail</a>} {oauth?.microsoft?.configured && <a className="btn" href="/api/oauth/microsoft/start">Connect Outlook</a>}</div>}
    {id === "slack" && <div><label className="f">Slack incoming webhook URL</label><input value={ws.slack_webhook_url || ""} placeholder="https://hooks.slack.com/services/…" onChange={e => setS({ ...s, workspace: { ...ws, slack_webhook_url: e.target.value } })} /><p className="muted">Fires on new leads and approval decisions.</p><div className="rowflex"><button className="btn" onClick={() => saveSettings({ slack_webhook_url: ws.slack_webhook_url || "" })}>Save</button><button className="btn ghost" onClick={async () => { const r = await api("/api/integrations/slack/test", { method: "POST", body: {} }).catch((e: any) => ({ error: e.message })); setMsg(r.ok ? "Test message sent to Slack ✓" : "Test failed — save the URL first, then check it."); }}>Send test message</button></div></div>}
    {id === "stripe" && <div><p className="muted">Status: {typeof window !== "undefined" ? "" : ""}keys are a deployment-level secret (STRIPE_SECRET_KEY) — until set, deposits run in explicit test mode.</p><label className="f">Deposit % required on signature</label><input type="number" value={ws.deposit_pct ?? 25} onChange={e => setS({ ...s, workspace: { ...ws, deposit_pct: Number(e.target.value) } })} /><div style={{ marginTop: 8 }}><button className="btn" onClick={() => saveSettings({ deposit_pct: ws.deposit_pct ?? 25 })}>Save deposit %</button></div><p className="muted">Workpile's own subscriptions are managed in Billing.</p></div>}
    {id === "zapier_make" && <div><p className="muted">No separate app needed — both platforms speak REST + webhooks:</p><p>1. Generate an API key (REST API card).<br />2. In Zapier/Make, use <b>Webhooks by Zapier / HTTP</b> actions against https://workpile.io/v1/… with that key as a Bearer header.<br />3. For triggers, register a webhook endpoint above and point your Zap/Scenario at the same events.</p></div>}
    {id === "handoff" && <div><p className="muted">Every final — won, lost, no response, N/A, junk, duplicate — is delivered to the customer's own platform two ways:</p><p>· <b>Pull:</b> <span className="mono">GET /v1/outcomes</span>, then <span className="mono">POST /v1/outcomes/:id/ack</span> with their system ID. Won leads include the full project package (<span className="mono">GET /v1/projects/:leadId</span>).<br />· <b>Push:</b> the <span className="mono">outcome.final</span> webhook event (configure under Event Webhooks).</p><button className="btn" onClick={() => onJump && onJump("handoffs")}>Open Handoff Monitor →</button></div>}
  </div></div>;
}

const PLANS_FALLBACK: any[] = [
  { key: "starter", name: "Starter", users: 2, active_requests: 150, list_price: 49, annual_price: 39, save_pct: 20, blurb: "For the small office getting its pile under control.", highlights: ["Price book, proposals, e-sign + deposits", "Email follow-ups + cadences", "Work Queue + AI agent (rules mode)", "Field crew always free"] },
  { key: "pro", name: "Pro", users: 5, active_requests: 750, list_price: 149, annual_price: 119, save_pct: 20, blurb: "The full execution system for a working office.", highlights: ["Everything in Starter", "SMS follow-ups", "API, webhooks + QuickBooks", "Your own sending domain", "Approval policies in full"] },
  { key: "business", name: "Business", users: 15, active_requests: 3000, list_price: 349, annual_price: 299, save_pct: 14, blurb: "For multi-crew operations that run on the numbers.", highlights: ["Everything in Pro", "Audit-log export", "Advanced permissions", "Priority support + onboarding call"] },
  { key: "enterprise", name: "Enterprise", users: 0, active_requests: 1000000, list_price: 0, annual_price: 0, save_pct: 0, custom: true, blurb: "Priced to your operation.", highlights: ["SSO/SAML + SCIM", "DPA + SLA", "Multiple locations", "Custom integrations"] },
];
function PlanCards({ onAction, currentKey }: any) {
  const [period, setPeriod] = useState<"monthly" | "annual">("annual");
  const [plans, setPlans] = useState<any[]>(PLANS_FALLBACK);
  useEffect(() => { api("/api/plans").then(r => { if (r.plans?.length) setPlans(r.plans); }).catch(() => {}); }, []);
  const maxSave = Math.max(...plans.filter(p => !p.custom).map(p => p.save_pct || 0));
  return (<div>
    <div className="rowflex" style={{ justifyContent: "center", margin: "4px 0 2px" }}>
      <div className="billtoggle">
        <button className={period === "monthly" ? "on" : ""} onClick={() => setPeriod("monthly")}>Monthly</button>
        <button className={period === "annual" ? "on" : ""} onClick={() => setPeriod("annual")}>Yearly<span className="saveTag">Save up to {maxSave}%</span></button>
      </div>
    </div>
    {period === "annual" && <div className="salebar"><span className="tag">SALE</span><span>Yearly billing is on sale — up to {maxSave}% off the regular monthly price, locked in when you subscribe.</span></div>}
    <div className="planGrid">{plans.map((p: any) => <div className={"planCard" + (p.key === "pro" ? " pop" : "")} key={p.key} style={currentKey === p.key ? { outline: "2px solid #22c55e", outlineOffset: 2 } : {}}>
      {p.key === "pro" && <span className="popTag">★ MOST POPULAR</span>}
      <div className="pcHead"><span className="pcName">{p.name}</span>{p.users ? <span className="pcUsers">{p.users} office users included</span> : <span className="pcUsers">Custom terms</span>}</div>
      {p.custom ? <div className="pcPriceRow"><span className="pcPrice">Custom</span></div> : period === "annual"
        ? <div className="pcPriceRow"><span className="pcPrice">{px(p.annual_price)}</span><span className="pcPer">/mo</span></div>
        : <div className="pcPriceRow"><span className="pcPrice">{px(p.list_price)}</span><span className="pcPer">/mo</span></div>}
      <div className="pcBill">{p.custom ? "Scoped to your operation" : period === "annual" ? <><s className="pcWas">{px(p.list_price)}</s> Billed annually · {px(p.annual_price * 12)}/yr <span className="savePill">SAVE {p.save_pct}%</span></> : `Billed monthly · or ${px(p.annual_price)}/mo yearly`}</div>
      <p className="pcBlurb">{p.blurb}</p>
      <ul className="pcFeat">{(p.highlights || []).map((h: string) => <li key={h}><span className="pcTick">✓</span>{h}</li>)}</ul>
      {!p.custom && <div className="pcMeter">Up to <b>{num(p.active_requests)}</b> active requests · overage never blocks intake</div>}
      <button className={"btn pcBtn" + (p.key === "pro" ? " popBtn" : "")} disabled={currentKey === p.key} onClick={() => onAction && onAction(p.key, period)}>{currentKey === p.key ? "Current plan" : p.custom ? "Talk to us" : currentKey ? `Switch to ${p.name}` : "Start free"}</button>
    </div>)}</div>
  </div>);
}

const px = (n: number) => "$" + Number(n).toFixed(2);
function Billing() {
  const [b, setB] = useState<any>(null);
  useEffect(() => { api("/api/billing").then(setB).catch(() => {}); }, []);
  if (!b) return <p className="muted">Loading billing…</p>;
  return (<div><h2 className="pt">Billing</h2><p className="sub">Your Workpile subscription — plan, trial, and live usage against your caps.</p>
    <div className="kpis">
      <div className="kpi"><div className="lab">Plan</div><div className="val">{b.plan.name}</div><div className="hint">{b.plan.custom ? "Custom pricing" : <><s className="muted">{px(b.plan.list_price)}</s> <b>{px(b.plan.annual_price)}/mo</b> billed annually</>}</div></div>
      <div className="kpi"><div className="lab">Office users</div><div className="val">{b.usage.users_used ?? b.usage.seats_used}{(b.usage.users_limit ?? b.usage.seats_limit) ? ` / ${b.usage.users_limit ?? b.usage.seats_limit}` : ""}</div><div className="hint">{(b.usage.users_limit ?? b.usage.seats_limit) ? "logins included in this plan — roster crew never count" : "unlimited"}</div></div>
      <div className="kpi"><div className="lab">Status</div><div className="val" style={{ fontSize: 20 }}>{b.subscription.status}</div><div className="hint">{b.trial_days_left !== null ? `${b.trial_days_left} trial days left` : "—"}</div></div>
      <div className="kpi"><div className="lab">Active requests</div><div className="val">{num(b.usage.active_requests || 0)}</div><div className="hint">of {num(b.usage.active_allowance || 0)} included ({b.usage.active_pct || 0}%) — overage never blocks intake</div></div>
      <div className="kpi"><div className="lab">AI actions</div><div className="val">{num(b.usage.ai_actions_this_month)}</div><div className="hint">of {num(b.usage.ai_limit)}</div></div>
    </div>
    {b.usage.leads_pct >= 80 && <div className="err">You're at {b.usage.leads_pct}% of your monthly lead cap — ingestion pauses at 100%, approvals never do.</div>}
    <div className="card"><h3>Plans — per workspace; yearly is on sale</h3><PlanCards currentKey={b.plan.key} onAction={async (k: string, period: string) => { const r = await api("/api/billing/checkout", { method: "POST", body: { plan: k, period } }); if (r.url) location.href = r.url; else alert(r.message || "Recorded — checkout opens when Stripe is configured."); }} /></div>
  </div>);
}

const stPill = (s: string) => { const map: any = { trialing: ["⏳ Trialing", "#92400e", "#fef3c7"], active: ["● Active", "#166534", "#dcfce7"], past_due: ["⚠ Past due", "#991b1b", "#fee2e2"], canceled: ["Canceled", "#475569", "#e2e8f0"], none: ["No subscription", "#475569", "#e2e8f0"] }; const [label, fg, bg] = map[s] || [s, "#334155", "#e2e8f0"]; return <span style={{ background: bg, color: fg, borderRadius: 999, padding: "2px 9px", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>{label}</span>; };

function Admin() {
  const [tab, setTab] = useState("customers"); const [ov, setOv] = useState<any>(null);
  useEffect(() => { api("/api/admin/overview").then(setOv).catch(() => {}); }, []);
  return (<div><h2 className="pt">Platform Console</h2><p className="sub">Master view across every customer on this deployment — plans, trials, access and data. Every action here is written to the platform audit log.</p>
    {ov && <div className="kpis" style={{ marginBottom: 14 }}>
      <div className="kpi"><div className="lab">Workspaces</div><div className="val">{ov.workspaces}</div><div className="hint">{ov.signups_30d} new in 30 days</div></div>
      <div className="kpi"><div className="lab">Paying</div><div className="val">{ov.paying}</div><div className="hint">{ov.past_due} past due</div></div>
      <div className="kpi"><div className="lab">On trial</div><div className="val">{ov.trialing}</div><div className="hint">{ov.trials_expiring_7d} expiring within 7 days</div></div>
      <div className="kpi"><div className="lab">Est. MRR</div><div className="val">${Number(ov.mrr_estimate).toLocaleString()}</div><div className="hint">active plans, annual ÷ 12</div></div>
      <div className="kpi"><div className="lab">Users</div><div className="val">{ov.users}</div><div className="hint">{ov.disabled_users} disabled · {ov.suspended} suspended ws</div></div>
    </div>}
    <div className="rowflex" style={{ marginBottom: 12 }}>{[["customers", "🏢 Customers"], ["users", "👥 Users"], ["subs", "💳 Subscriptions"], ["activity", "🧾 Activity"], ["system", "🛠 System"]].map(([k, l]) => <button key={k} className={"chip" + (tab === k ? " on" : "")} onClick={() => setTab(k)}>{l}</button>)}</div>
    {tab === "customers" && <AdminCustomers />}
    {tab === "users" && <AdminUsers />}
    {tab === "subs" && <AdminSubs />}
    {tab === "activity" && <AdminActivity />}
    {tab === "system" && <AdminSystem />}
  </div>);
}

function AdminCustomers() {
  const [rows, setRows] = useState<any[]>([]); const [q, setQ] = useState(""); const [f, setF] = useState("all"); const [sel, setSel] = useState("");
  const load = () => { api("/api/admin/customers" + (q ? "?q=" + encodeURIComponent(q) : "")).then(setRows).catch(() => {}); };
  useEffect(() => { load(); }, [q]);
  const shown = rows.filter(r => f === "all" ? true : f === "suspended" ? r.suspended : r.sub_status === f);
  return (<div>
    <div className="rowflex" style={{ marginBottom: 10 }}><input type="search" placeholder="Search workspace, owner name or email…" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 340 }} />
      {[["all", "All"], ["trialing", "Trialing"], ["active", "Paying"], ["past_due", "Past due"], ["suspended", "Suspended"]].map(([k, l]) => <button key={k} className={"chip" + (f === k ? " on" : "")} onClick={() => setF(k)}>{l}</button>)}</div>
    <div className="card" style={{ padding: 6, overflowX: "auto" }}><table><thead><tr><th>Workspace</th><th>Plan</th><th>Status</th><th>Trial / period ends</th><th>Users</th><th>Leads</th><th>Signed</th><th>Last activity</th><th>Joined</th></tr></thead><tbody>
      {shown.map(w => <tr key={w.id} onClick={() => setSel(w.id)} style={{ cursor: "pointer", opacity: w.suspended ? 0.62 : 1 }}><td><b>{w.name}</b>{w.suspended && <span style={{ color: "#991b1b", fontWeight: 700 }}> · SUSPENDED</span>}<br /><span className="muted">{w.owner ? `${w.owner.name} · ${w.owner.email}` : "no owner"}</span></td><td style={{ textTransform: "capitalize" }}>{w.plan}</td><td>{stPill(w.sub_status)}</td><td>{w.current_period_end ? new Date(w.current_period_end).toLocaleDateString() : "—"}</td><td>{num(w.users)}</td><td>{num(w.leads)}</td><td>{money(w.signed_value)}</td><td>{w.last_activity ? new Date(w.last_activity).toLocaleDateString() : "—"}</td><td>{new Date(w.created_at).toLocaleDateString()}</td></tr>)}
      {shown.length === 0 && <tr><td colSpan={9} className="muted" style={{ padding: 16 }}>No customers match.</td></tr>}
    </tbody></table></div>
    {sel && <AdminCustomerDrawer id={sel} close={() => setSel("")} changed={load} />}
  </div>);
}

function AdminCustomerDrawer({ id, close, changed }: any) {
  const [d, setD] = useState<any>(null); const [plan, setPlan] = useState("pro"); const [delName, setDelName] = useState(""); const [busy, setBusy] = useState("");
  const load = () => { api("/api/admin/customers/" + id).then((r: any) => { setD(r); setPlan(r.plan); }).catch(() => {}); };
  useEffect(() => { load(); }, [id]);
  if (!d) return <div className="adminDrawer"><p className="muted">Loading…</p></div>;
  const act = async (label: string, fn: () => Promise<any>) => { setBusy(label); try { await fn(); toast(label + " ✓"); load(); changed && changed(); } catch (e: any) { toast(e.message || "Failed"); } setBusy(""); };
  return (<div className="adminDrawer"><div className="rowflex" style={{ justifyContent: "space-between" }}><h3 style={{ margin: 0 }}>{d.name}</h3><button className="btn ghost small" onClick={close}>✕</button></div>
    <p className="muted" style={{ margin: "4px 0 10px" }}>{d.owner ? `${d.owner.name} · ${d.owner.email}` : "no owner"} · joined {new Date(d.created_at).toLocaleDateString()} · {d.users.length} users · {num(d.leads)} leads · {num(d.jobs)} jobs · {money(d.signed_value)} signed</p>
    <div className="rowflex">{stPill(d.sub_status)}{d.suspended && <span style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 999, padding: "2px 9px", fontSize: 11.5, fontWeight: 700 }}>SUSPENDED</span>}<span className="muted">via {d.source || "—"}{d.current_period_end ? ` · period ends ${new Date(d.current_period_end).toLocaleDateString()}` : ""}</span></div>
    <h4 className="pcH">Plan & trial</h4>
    <div className="rowflex"><select value={plan} onChange={e => setPlan(e.target.value)} style={{ width: 150 }}>{["starter", "pro", "business", "enterprise"].map(p => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}</select>
      <button className="btn small" disabled={busy !== ""} onClick={() => act("Plan set to " + plan, () => api(`/api/admin/customers/${id}/plan`, { method: "POST", body: { plan } }))}>Set plan</button>
      <button className="btn ghost small" disabled={busy !== ""} onClick={() => act("Trial extended 7 days", () => api(`/api/admin/customers/${id}/trial`, { method: "POST", body: { days: 7 } }))}>Trial +7d</button>
      <button className="btn ghost small" disabled={busy !== ""} onClick={() => act("Trial extended 30 days", () => api(`/api/admin/customers/${id}/trial`, { method: "POST", body: { days: 30 } }))}>Trial +30d</button></div>
    <p className="muted">Setting a plan without a Stripe subscription comps the workspace (recorded as a manual plan). Stripe ids: {d.stripe_customer_id || "—"} / {d.stripe_subscription_id || "—"}</p>
    <h4 className="pcH">Users ({d.users.length})</h4>
    <table><thead><tr><th>User</th><th>Role</th><th></th></tr></thead><tbody>{d.users.map((u: any) => <tr key={u.id} style={{ opacity: u.disabled ? 0.55 : 1 }}><td><b>{u.name}</b>{!!u.is_platform_admin && " 🛡"}<br /><span className="muted">{u.email}</span></td>
      <td><select style={{ width: 126 }} value={u.role} onChange={e => act("Role updated", () => api(`/api/admin/users/${u.id}/role`, { method: "POST", body: { role: e.target.value, workspace_id: id } }))}>{["OWNER", "APPROVER", "OPS_ADMIN", "LEAD_OWNER", "PM"].map(r => <option key={r} value={r}>{r}</option>)}</select></td>
      <td><div className="rowflex"><button className="btn ghost small" onClick={async () => { await api("/api/admin/impersonate", { method: "POST", body: { user_id: u.id } }); location.reload(); }}>Impersonate</button>
      <button className="btn ghost small" onClick={() => act(u.disabled ? "User enabled" : "User disabled", () => api(`/api/admin/users/${u.id}/disable`, { method: "POST", body: { disabled: !u.disabled } }))}>{u.disabled ? "Enable" : "Disable"}</button></div></td></tr>)}</tbody></table>
    <h4 className="pcH">Access</h4>
    <div className="rowflex">{d.suspended
      ? <button className="btn" disabled={busy !== ""} onClick={() => act("Workspace reactivated", () => api(`/api/admin/customers/${id}/suspend`, { method: "POST", body: { suspended: false } }))}>▶ Reactivate workspace</button>
      : <button className="btn ghost" disabled={busy !== ""} onClick={() => { if (confirm(`Suspend ${d.name}? Its team is locked out until you reactivate. Data is kept.`)) act("Workspace suspended", () => api(`/api/admin/customers/${id}/suspend`, { method: "POST", body: { suspended: true } })); }}>⏸ Suspend workspace</button>}</div>
    <h4 className="pcH" style={{ color: "#991b1b" }}>Danger zone</h4>
    <p className="muted">Delete this workspace and ALL its data (leads, proposals, jobs, files metadata, users who belong only here). This cannot be undone. Type the workspace name to confirm.</p>
    <div className="rowflex"><input placeholder={d.name} value={delName} onChange={e => setDelName(e.target.value)} style={{ maxWidth: 220 }} />
      <button className="btn" style={{ background: "#991b1b" }} disabled={delName !== d.name || busy !== ""} onClick={() => act("Workspace deleted", async () => { await api(`/api/admin/customers/${id}`, { method: "DELETE" }); close(); })}>Delete workspace</button></div>
    {d.admin_actions?.length > 0 && <><h4 className="pcH">Operator actions</h4>{d.admin_actions.map((x: any, i: number) => <p key={i} className="muted" style={{ margin: "3px 0" }}>{new Date(x.created_at).toLocaleString()} · {x.admin_email} · {x.action}</p>)}</>}
    {d.activity?.length > 0 && <><h4 className="pcH">Recent workspace activity</h4>{d.activity.map((x: any, i: number) => <p key={i} className="muted" style={{ margin: "3px 0" }}>{new Date(x.created_at).toLocaleString()} · {x.action} · {x.entity}</p>)}</>}
  </div>);
}

function AdminUsers() {
  const [rows, setRows] = useState<any[]>([]); const [q, setQ] = useState("");
  const load = () => { api("/api/admin/users" + (q ? "?q=" + encodeURIComponent(q) : "")).then(setRows).catch(() => {}); };
  useEffect(() => { load(); }, [q]);
  const act = async (label: string, fn: () => Promise<any>) => { try { await fn(); toast(label + " ✓"); load(); } catch (e: any) { toast(e.message || "Failed"); } };
  return (<div>
    <input type="search" placeholder="Search name or email…" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 340, marginBottom: 10 }} />
    <div className="card" style={{ padding: 6, overflowX: "auto" }}><table><thead><tr><th>User</th><th>Current workspace</th><th>Role</th><th>Access</th><th></th></tr></thead><tbody>
      {rows.map(u => <tr key={u.id} style={{ opacity: u.disabled ? 0.55 : 1 }}><td><b>{u.name}</b>{u.is_platform_admin && " 🛡"}<br /><span className="muted">{u.email} · member of {u.workspaces}</span></td><td>{u.workspace_name || "—"}</td><td>{u.role}</td>
        <td>{u.disabled ? <span style={{ color: "#991b1b", fontWeight: 700 }}>Disabled</span> : "Active"}{u.is_platform_admin && <span className="muted"> · platform admin</span>}</td>
        <td><div className="rowflex"><button className="btn ghost small" onClick={async () => { await api("/api/admin/impersonate", { method: "POST", body: { user_id: u.id } }); location.reload(); }}>Impersonate</button>
          <button className="btn ghost small" onClick={() => act(u.disabled ? "Enabled" : "Disabled", () => api(`/api/admin/users/${u.id}/disable`, { method: "POST", body: { disabled: !u.disabled } }))}>{u.disabled ? "Enable" : "Disable"}</button>
          <button className="btn ghost small" onClick={() => { if (confirm((u.is_platform_admin ? "Revoke platform admin from " : "Grant platform admin to ") + u.email + "?")) act("Admin access updated", () => api(`/api/admin/users/${u.id}/platform-admin`, { method: "POST", body: { on: !u.is_platform_admin } })); }}>{u.is_platform_admin ? "Revoke admin" : "Make admin"}</button>
          <button className="btn ghost small" onClick={() => { if (confirm(`Delete the account ${u.email}? Their authored work stays; their access ends.`)) act("User deleted", () => api(`/api/admin/users/${u.id}`, { method: "DELETE" })); }}>Delete</button></div></td></tr>)}
      {rows.length === 0 && <tr><td colSpan={5} className="muted" style={{ padding: 16 }}>No users match.</td></tr>}
    </tbody></table></div></div>);
}

function AdminSubs() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api("/api/admin/subscriptions").then(setRows).catch(() => {}); }, []);
  return (<div className="card" style={{ padding: 6, overflowX: "auto" }}><table><thead><tr><th>Workspace</th><th>Plan</th><th>Status</th><th>Source</th><th>Started</th><th>Period ends</th><th>Monthly value</th><th>Stripe sub</th></tr></thead><tbody>
    {rows.map(s => <tr key={s.id}><td><b>{s.workspace_name}</b></td><td style={{ textTransform: "capitalize" }}>{s.plan}</td><td>{stPill(s.status)}</td><td>{s.source || (s.stripe_subscription_id ? "stripe" : "—")}</td><td>{new Date(s.created_at).toLocaleDateString()}</td><td>{s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "—"}</td><td>{s.monthly_value ? money(s.monthly_value) : "—"}</td><td className="muted">{s.stripe_subscription_id || "—"}</td></tr>)}
    {rows.length === 0 && <tr><td colSpan={8} className="muted" style={{ padding: 16 }}>No subscriptions yet.</td></tr>}
  </tbody></table></div>);
}

function AdminActivity() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api("/api/admin/audit").then(setRows).catch(() => {}); }, []);
  return (<div className="card"><h3 style={{ marginTop: 0 }}>Platform audit log</h3>
    {rows.map(x => <p key={x.id} style={{ margin: "6px 0", borderBottom: "1px solid #eef1ee", paddingBottom: 6 }}><b>{x.action}</b> <span className="muted">· {x.admin_email} · {new Date(x.created_at).toLocaleString()}{x.workspace_id ? ` · ws ${String(x.workspace_id).slice(0, 10)}…` : ""}</span><br /><span className="muted">{String(x.detail || "").slice(0, 160)}</span></p>)}
    {rows.length === 0 && <p className="muted">No operator actions recorded yet — plan changes, suspensions, deletions and access changes land here.</p>}</div>);
}

function AdminSystem() {
  const [ws, setWs] = useState<any[]>([]); const [syn, setSyn] = useState<any>(null); const [dlq, setDlq] = useState<any[]>([]);
  useEffect(() => { api("/api/admin/workspaces").then(setWs).catch(() => {}); api("/api/admin/dlq").then(setDlq).catch(() => {}); }, []);
  return (<div><ActivationCard />
    <div className="card" style={{ padding: 6 }}><table><thead><tr><th>Workspace</th><th>Leads</th><th>Users</th><th>Pending approvals</th><th>Dead letters</th></tr></thead><tbody>{ws.map((w: any) => <tr key={w.id}><td>{w.name}</td><td>{num(w.leads)}</td><td>{num(w.users)}</td><td>{num(w.pending_approvals)}</td><td>{num(w.dead_letters)}</td></tr>)}</tbody></table></div>
    <div className="card"><h3>Dead-letter queue ({dlq.length})</h3>{dlq.map((d: any) => <p key={d.id} className="muted">{d.outcome} · lead {String(d.lead_id).slice(0, 14)}… · {d.last_error || ""}</p>)}{dlq.length === 0 && <p className="muted">Empty — every delivery either landed or is still retrying.</p>}
      <button className="btn" onClick={async () => setSyn(await api("/api/admin/synthetics"))}>Run SLO synthetics</button>
      {syn && <pre className="mono" style={{ marginTop: 10 }}>{JSON.stringify(syn, null, 1).slice(0, 900)}</pre>}</div>
  </div>);
}

function CreateLead({ users, done }: any) {
  const [f, setF] = useState<any>({ contact: { name: "", phone: "", email: "" }, service_requested: "", est_value: "", message: "", location: "" }); const [msg, setMsg] = useState("");
  return (<div className="modalWrap"><div className="modal" style={{ maxWidth: 560 }}><h3 style={{ marginTop: 0 }}>New lead</h3>{msg && <div className="err">{msg}</div>}
    <div className="formgrid">
      <div><label className="f">Contact name *</label><input value={f.contact.name} onChange={e => setF({ ...f, contact: { ...f.contact, name: e.target.value } })} /></div>
      <div><label className="f">Phone *</label><input value={f.contact.phone} onChange={e => setF({ ...f, contact: { ...f.contact, phone: e.target.value } })} /></div>
      <div><label className="f">Email</label><input value={f.contact.email} onChange={e => setF({ ...f, contact: { ...f.contact, email: e.target.value } })} /></div>
      <div><label className="f">Service requested</label><input value={f.service_requested} onChange={e => setF({ ...f, service_requested: e.target.value })} /></div>
      <div><label className="f">Estimated value ($)</label><input type="number" value={f.est_value} onChange={e => setF({ ...f, est_value: e.target.value })} /></div>
      <div><label className="f">Location</label><input value={f.location} onChange={e => setF({ ...f, location: e.target.value })} /></div>
      <div className="full"><label className="f">What happened / notes</label><textarea rows={3} value={f.message} onChange={e => setF({ ...f, message: e.target.value })} /></div>
    </div>
    <div className="rowflex" style={{ marginTop: 14 }}><button className="btn" onClick={async () => { try { const r = await api("/api/leads", { method: "POST", body: { ...f, est_value: Number(f.est_value) || 0, source: "manual" } }); done(r.lead?.id); } catch (e: any) { setMsg(e.message); } }}>Create lead</button><button className="btn ghost" onClick={() => done(null)}>Cancel</button></div>
  </div></div>);
}

function WeeklyReportCard() {
  const mondayOf = (d: Date) => { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x.toISOString().slice(0, 10); };
  const [week, setWeek] = useState(mondayOf(new Date())); const [r, setR] = useState<any>(null); const [copied, setCopied] = useState(false);
  useEffect(() => { api("/api/status-report?week=" + week).then(setR).catch(() => {}); }, [week]);
  const shift = (n: number) => { const d = new Date(week + "T12:00:00"); d.setDate(d.getDate() + n * 7); setWeek(mondayOf(d)); };
  return (<div className="card" style={{ borderLeft: "4px solid #166534" }}><div className="rowflex" style={{ justifyContent: "space-between" }}><h3 style={{ margin: 0 }}>📋 Weekly Status Report — the owner's one-pager</h3>
    <span className="rowflex"><button className="btn ghost small" onClick={() => shift(-1)}>← Prev</button><b>Week of {week}</b><button className="btn ghost small" onClick={() => shift(1)}>Next →</button>
    <a className="btn ghost small" style={{ textDecoration: "none" }} href={`/print/status-report?week=${week}`} target="_blank" rel="noreferrer">🖨 Print / PDF</a>
    <button className="btn small" onClick={async () => { if (r?.text) { await navigator.clipboard.writeText(r.text).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); } }}>{copied ? "Copied ✓" : "Copy summary"}</button></span></div>
    {!r && <p className="muted">Building your week…</p>}
    {r && <div className="kpis" style={{ marginTop: 12, gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
      <div className="kpi"><div className="lab">New leads</div><div className="val">{r.new_leads}</div><div className="hint">Backlog open: {r.backlog.open} ({money(r.backlog.pipeline_value)})</div></div>
      <div className="kpi"><div className="lab">Won</div><div className="val">{r.won.count}</div><div className="hint">{money(r.won.value)} · Lost {r.lost.count} · No response {r.no_response}</div></div>
      <div className="kpi"><div className="lab">Proposals</div><div className="val">{r.proposals.count}</div><div className="hint">{money(r.proposals.value)} created this week</div></div>
      <div className="kpi"><div className="lab">Approvals</div><div className="val">{r.approvals.rate ?? "—"}{r.approvals.rate !== null && r.approvals.rate !== undefined ? "%" : ""}</div><div className="hint">{r.approvals.decided} decided · {r.approvals.pending} waiting</div></div>
      <div className="kpi"><div className="lab">Field reports</div><div className="val">{r.field_reports.pct ?? "—"}{r.field_reports.pct !== null && r.field_reports.pct !== undefined ? "%" : ""}</div><div className="hint">{r.field_reports.filed}/{r.field_reports.expected} filed</div></div>
      <div className="kpi"><div className="lab">Timesheets</div><div className="val">{r.timesheets.pct ?? "—"}{r.timesheets.pct !== null && r.timesheets.pct !== undefined ? "%" : ""}</div><div className="hint">{r.timesheets.submitted}/{r.timesheets.expected} submitted</div></div>
      <div className="kpi"><div className="lab">Labor</div><div className="val">{r.labor.hours}h</div><div className="hint">{money(r.labor.cost)} across {r.labor.jobs} jobs</div></div>
      <div className="kpi"><div className="lab">Inbox</div><div className="val">{r.inbox.cleared}</div><div className="hint">cleared · {r.inbox.open_now} still open</div></div>
    </div>}
    {r && r.top_jobs?.length > 0 && <p className="muted" style={{ marginBottom: 0 }}>Top jobs by labor: {r.top_jobs.map((j: any) => `${j.service_requested} (${j.customer || "—"}) — ${j.h}h / ${money(j.a)}`).join(" · ")}</p>}
  </div>);
}

function InvoicesCard() {
  const [invs, setInvs] = useState<any[]>([]); const [msg, setMsg] = useState("");
  const load = () => { api("/api/invoices").then(setInvs).catch(() => {}); };
  useEffect(load, []);
  const open = invs.filter(i => ["sent", "partially_paid"].includes(i.status));
  return (<div className="card" style={{ marginBottom: 14 }}><h3 style={{ marginTop: 0 }}>🧾 Invoices & receivables</h3>
    <p className="sub" style={{ marginTop: 0 }}>{money(open.reduce((a, i) => a + (i.balance || 0), 0))} outstanding across {open.length} open invoice{open.length === 1 ? "" : "s"}{open.some(i => i.overdue) ? ` · ${money(open.filter(i => i.overdue).reduce((a, i) => a + i.balance, 0))} overdue` : ""}. Every number on Home drills into its records — click a figure there, or work the invoices here.</p>
    {invs.slice(0, 12).map(i => <div key={i.id} className="rowflex" style={{ padding: "5px 0", borderTop: "1px solid #eef2f7", flexWrap: "wrap" }}><span style={{ flex: 1 }}><b>{i.number}</b> · {i.service_requested || "Job"} · {money(i.total)} · {i.status}{i.overdue ? " · ⚠ overdue" : ""}{i.job_id ? <> · <a href="#" onClick={e => { e.preventDefault(); (window as any).wpOpenJob?.(i.job_id); }}>open job →</a></> : ""}</span><InvoiceActions inv={i} onDone={load} />
      {i.balance > 0 && i.status !== "void" && <span className="rowflex"><input id={"pay-" + i.id} type="number" placeholder="Amount" style={{ width: 100 }} /><button className="btn ghost small" onClick={async () => { const v = Number((document.getElementById("pay-" + i.id) as HTMLInputElement).value); if (!(v > 0)) return; try { await api(`/api/invoices/${i.id}/payments`, { method: "POST", body: { amount: v } }); toast(`Payment of ${money(v)} recorded ✓`); load(); } catch (e: any) { setMsg(e.message); } }}>Record payment</button></span>}
    </div>)}
    {invs.length === 0 && <p className="muted">No invoices yet — create one from a job that's ready to bill.</p>}
    {msg && <div className="err">{msg}</div>}
    <button className="btn ghost small" style={{ marginTop: 8 }} onClick={async () => { const r = await api("/api/invoices/backfill", { method: "POST", body: {} }); setMsg(`Backfill created ${r.made} invoice records from previously flagged jobs.`); load(); }}>Backfill invoices for already-flagged jobs</button>
  </div>);
}

function Reports() {
  const [fc, setFc] = useState<any>(null);
  useEffect(() => { api("/api/forecast").then(setFc).catch(() => {}); }, []);
  const [ds, setDs] = useState("by_owner"); const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api("/api/reports?dataset=" + ds).then(r => setRows(r.rows)).catch(() => {}); }, [ds]);
  const tot = rows.reduce((a, r) => ({ leads: a.leads + (r.leads || 0), won: a.won + (r.won || 0), lost: a.lost + (r.lost || 0), value: a.value + (r.value || 0), won_value: a.won_value + (r.won_value || 0) }), { leads: 0, won: 0, lost: 0, value: 0, won_value: 0 });
  return (<div><h2 className="pt">Reports</h2><InvoicesCard /><p className="sub">Tabular reports over your live data — the Salesforce Reports equivalent, without the report-builder maze. Export anything to CSV.</p>
    <ReportBuilder />
    <WeeklyReportCard />
    {fc && <><div className="kpis">
      <div className="kpi"><div className="lab">🔮 Weighted forecast</div><div className="val">{money(fc.weighted_pipeline)}</div><div className="hint">of {money(fc.raw_pipeline)} raw pipeline, probability-weighted by stage</div></div>
      <div className="kpi"><div className="lab">🎯 Win rate (30d)</div><div className="val">{fc.intel.win_rate_30d === null ? "—" : fc.intel.win_rate_30d + "%"}</div><div className="hint">{num(fc.intel.decided_30d)} decided in the last 30 days</div></div>
      <div className="kpi"><div className="lab">🥇 Best source</div><div className="val" style={{ fontSize: 20 }}>{fc.intel.best_source?.name || "—"}</div><div className="hint">{fc.intel.best_source ? money(fc.intel.best_source.won_value) + " won all-time" : "No wins yet"}</div></div>
      <div className="kpi"><div className="lab">🛑 Top loss reason</div><div className="val" style={{ fontSize: 20 }}>{fc.intel.top_lost_reason?.reason?.replaceAll("_", " ") || "—"}</div><div className="hint">{fc.intel.top_lost_reason ? num(fc.intel.top_lost_reason.count) + " losses in 30 days" : "No losses logged"}</div></div>
    </div>
    {fc.at_risk.length > 0 && <div className="card" style={{ marginBottom: 12 }}><h3 style={{ marginTop: 0 }}>⚠️ Proposals going cold</h3>{fc.at_risk.map((r: any) => <p key={r.lead_id} style={{ margin: "6px 0" }}><b>{r.contact_name}</b> <span className="muted">· {r.service_requested} · {money(r.total)} · waiting {r.days_waiting} days</span></p>)}<p className="muted">Sent 4+ days ago, still unsigned. The follow-up cadence is nudging; a human call beats a third email.</p></div>}</>}
    <div className="chips">{[["by_owner", "By owner"], ["by_service", "By service"], ["by_stage", "By stage"], ["by_source", "By source"], ["lost_reasons", "Lost reasons"]].map(([k, lab]) => <button key={k} className={`chip ${ds === k ? "on" : ""}`} onClick={() => setDs(k)}>{lab}</button>)}
      <a className="btn small" style={{ textDecoration: "none" }} href={`/api/reports/export?dataset=${ds}`}>⬇ Export CSV</a></div>
    <div className="card" style={{ padding: 6 }}><table><thead><tr><th>{ds.replaceAll("_", " ")}</th><th>Leads</th><th>Won</th><th>Lost</th>{ds === "by_source" && <th>Win rate</th>}<th>Pipeline value</th><th>Won value</th></tr></thead><tbody>
      {rows.map((r, i) => <tr key={i}><td><b>{r.label}</b></td><td>{num(r.leads)}</td><td>{num(r.won || 0)}</td><td>{num(r.lost || 0)}</td>{ds === "by_source" && <td>{r.leads ? Math.round(100 * (r.won || 0) / r.leads) + "%" : "—"}</td>}<td>{money(r.value)}</td><td>{money(r.won_value || 0)}</td></tr>)}
      <tr style={{ background: "#f8fafc" }}><td><b>Total</b></td><td><b>{num(tot.leads)}</b></td><td><b>{num(tot.won)}</b></td><td><b>{num(tot.lost)}</b></td>{ds === "by_source" && <td><b>{tot.leads ? Math.round(100 * tot.won / tot.leads) + "%" : "—"}</b></td>}<td><b>{money(tot.value)}</b></td><td><b>{money(tot.won_value)}</b></td></tr>
    </tbody></table></div></div>);
}

class EB extends React.Component<any, any> { state = { err: "" }; static getDerivedStateFromError(e: any) { return { err: String(e && e.message || e) }; } componentDidCatch(e: any, info: any) { console.error("EB-CATCH:", e.message, (info.componentStack || "").slice(0, 900)); } render() { return this.state.err ? <div className="card" style={{ maxWidth: 560, margin: "40px auto", textAlign: "center", padding: 28 }}><div style={{ fontSize: 30 }}>🧯</div><h3 style={{ margin: "8px 0" }}>This screen hit a snag</h3><p className="muted">The rest of Workpile is fine — your other tabs still work. This view failed to render:</p><p className="err" style={{ textAlign: "left" }}>{this.state.err}</p><button className="btn" onClick={() => this.setState({ err: "" })}>Try this view again</button></div> : this.props.children; } }

function LogoMark({ size = 30 }: any) { return (<svg width={size} height={size} viewBox="0 0 64 64" aria-label="Workpile" style={{ flex: "none", display: "block" }}><rect width="64" height="64" rx="14" fill="#0e5c3a"/><rect x="12" y="41" width="40" height="9" rx="4.5" fill="#ffffff"/><rect x="17" y="29.5" width="30" height="9" rx="4.5" fill="#ffffff" opacity="0.92"/><rect x="22" y="18" width="20" height="9" rx="4.5" fill="#4ade80"/></svg>); }
function Logo({ light }: any) { return <span className="logo" style={light ? { color: "#fff" } : {}}><LogoMark size={30} /><span className="ltxt">Workpile</span></span>; }

function JobFiles({ jobId }: any) {
  const [files, setFiles] = useState<any[]>([]); const [msg, setMsg] = useState("");
  const load = () => { api(`/api/attachments?entity_type=job&entity_id=${jobId}`).then(setFiles).catch(() => {}); };
  useEffect(load, [jobId]);
  useLive(load);
  const upload = (f: File) => { const r = new FileReader(); r.onload = async () => { try { const b64 = String(r.result || "").split(",")[1] || ""; await api("/api/attachments", { method: "POST", body: { entity_type: "job", entity_id: jobId, name: f.name, mime: f.type || "application/octet-stream", data_base64: b64 } }); setMsg("Uploaded ✓"); load(); } catch (e: any) { setMsg(e.message); } }; r.readAsDataURL(f); };
  const del = async (id: string) => { await api(`/api/attachments/${id}`, { method: "DELETE" }).catch(() => {}); load(); };
  const photos = files.filter(f => String(f.mime || "").startsWith("image/"));
  const assets = files.filter(f => !String(f.mime || "").startsWith("image/"));
  return (<div>
    <h4 style={{ marginTop: 16 }}>📷 Job photos <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>from the field — before, during, after</span></h4>
    {photos.length === 0 ? <p className="muted" style={{ margin: "4px 0" }}>No photos yet — site conditions, completed work, readings: if it matters, it's photographed and filed here.</p> :
      <div className="photoGrid">{photos.map(f => <figure key={f.id} className="photoCell"><a href={`/api/attachments/${f.id}/download?inline=1`} target="_blank" rel="noreferrer"><img src={`/api/attachments/${f.id}/download?inline=1`} alt={f.name} loading="lazy" /></a><figcaption><span className="photoName">{f.name}</span><button className="btn ghost small" style={{ padding: "0 5px" }} onClick={() => del(f.id)}>✕</button></figcaption></figure>)}</div>}
    <div className="rowflex"><label className="btn ghost small" style={{ cursor: "pointer" }}>📷 Add photo<input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} /></label></div>
    <h4 style={{ marginTop: 16 }}>🗂 Job assets <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>permits, manifests, equipment docs, signed paperwork</span></h4>
    {assets.map(f => <div key={f.id} className="rowflex" style={{ padding: "4px 0" }}><a href={`/api/attachments/${f.id}/download`}>{f.name}</a><span className="muted">{Math.max(1, Math.round(f.size / 1024))} KB · {dt(f.created_at)}</span><span style={{ flex: 1 }} /><button className="btn ghost small" onClick={() => del(f.id)}>Delete</button></div>)}
    {assets.length === 0 && <p className="muted" style={{ margin: "4px 0" }}>No files yet.</p>}
    <div className="rowflex"><label className="btn ghost small" style={{ cursor: "pointer" }}>📎 Add file<input type="file" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} /></label>{msg && <span className="ok">{msg}</span>}</div>
  </div>);
}

function AttachmentsPanel({ entityType, entityId }: any) {
  const [files, setFiles] = useState<any[]>([]); const [msg, setMsg] = useState("");
  const load = () => { api(`/api/attachments?entity_type=${entityType}&entity_id=${entityId}`).then(setFiles).catch(() => {}); };
  useEffect(load, [entityId]);
  const upload = (f: File) => { const r = new FileReader(); r.onload = async () => { try { const b64 = String(r.result || "").split(",")[1] || ""; await api("/api/attachments", { method: "POST", body: { entity_type: entityType, entity_id: entityId, name: f.name, mime: f.type || "application/octet-stream", data_base64: b64 } }); setMsg("Uploaded ✓"); load(); } catch (e: any) { setMsg(e.message); } }; r.readAsDataURL(f); };
  return (<div className="card" style={{ marginTop: 12 }}><h3 style={{ marginTop: 0 }}>📎 Attachments</h3>
    {files.map(f => <div key={f.id} className="rowflex" style={{ padding: "4px 0" }}><a href={`/api/attachments/${f.id}/download`}>{f.name}</a><span className="muted">{Math.max(1, Math.round(f.size / 1024))} KB · {dt(f.created_at)}</span><span style={{ flex: 1 }} /><button className="btn ghost small" onClick={async () => { await api(`/api/attachments/${f.id}`, { method: "DELETE" }); load(); }}>Delete</button></div>)}
    {files.length === 0 && <p className="muted" style={{ margin: "4px 0" }}>No files yet — permits, manifests, photos from the field live here (object storage, not email threads).</p>}
    <div className="rowflex"><label className="btn ghost small" style={{ cursor: "pointer" }}>+ Upload file<input type="file" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} /></label>{msg && <span className="ok">{msg}</span>}</div></div>);
}

function ProposalsView({ openLead }: any) {
  const [rows, setRows] = useState<any[]>([]); const [tab, setTab] = useState("list");
  useEffect(() => { api("/api/proposals").then(setRows).catch(() => {}); }, []);
  const counts = (st: string) => rows.filter(r => r.status === st).length;
  const outValue = rows.filter(r => r.status === "sent").reduce((a, r) => a + (r.total || 0), 0);
  const signedValue = rows.filter(r => r.status === "signed").reduce((a, r) => a + (r.total || 0), 0);
  if (tab === "approvals") return (<div><h2 className="pt">Proposals</h2><div className="tabs"><button onClick={() => setTab("list")}>All proposals</button><button className="on">Approvals</button></div><Approvals openLead={openLead} embedded /></div>);
  return (<div><h2 className="pt">Proposals</h2><p className="sub">Every proposal in the business — priced from the book, gated by policy, tracked to signature. Approvals live here and in the Work Queue.</p>
    <div className="tabs"><button className="on">All proposals</button><button onClick={() => setTab("approvals")}>Approvals</button></div>
    <div className="rowflex" style={{ marginBottom: 10 }}><span className="chip">{rows.length} total</span><span className="chip">{counts("draft")} drafts</span><span className="chip">{counts("sent")} out · {money(outValue)}</span><span className="chip">{counts("signed")} signed · {money(signedValue)}</span></div>
    {rows.map(r => <div key={r.id} className="card" style={{ padding: "10px 14px", marginBottom: 7, display: "flex", gap: 10, alignItems: "center" }}><div style={{ flex: 1 }}><b>{r.contact_name || "Customer"}</b> — {r.service_requested || ""} <span className="muted">· v{r.version} · {dt(r.created_at)}{r.sent_at ? " · sent " + dt(r.sent_at) : ""}{r.signed_at ? " · signed " + dt(r.signed_at) : ""}</span></div><b>{money(r.total)}</b><span className={`st ${r.status === "signed" ? "pass" : r.status === "sent" ? "warn" : "fail"}`}>{r.status}</span><button className="btn ghost small" onClick={() => openLead(r.lead_id)}>Open lead →</button></div>)}
    {rows.length === 0 && <div className="card" style={{ textAlign: "center", padding: 26 }}>No proposals yet — build the first one from any lead.</div>}
  </div>);
}

function InboxPage() {
  const [inbox, setInbox] = useState<any[]>([]);
  const load = () => { api("/api/inbox").then(setInbox).catch(() => {}); };
  useEffect(load, []);
  useLive(load);
  return (<div><h2 className="pt">Inbox</h2><p className="sub">Every inbound message, triaged into seven categories with a suggested action — convert, reply, file, or ignore. Nothing sits unread and unowned.</p><InboxQueue inbox={inbox} reload={load} /></div>);
}

function VerticalPacksCard() {
  const [packs, setPacks] = useState<any[]>([]); const [msg, setMsg] = useState("");
  useEffect(() => { api("/api/templates/verticals").then(setPacks).catch(() => {}); }, []);
  if (!packs.length) return null;
  const apply = async (id: string) => { try { const r = await api(`/api/templates/verticals/${id}/apply`, { method: "POST", body: {} }); setMsg(`${r.pack}: +${r.added.services} services, +${r.added.price_book_items} price-book items, +${r.added.custom_fields} fields. ${r.note}`); } catch (e: any) { setMsg(e.message); } };
  return (<div style={{ marginBottom: 16 }}><h3>Vertical starter packs</h3><p className="muted" style={{ marginTop: 0 }}>Start from your trade's shape: services, a price-book skeleton (prices at $0 — yours to set), and lead fields. Applying twice adds nothing twice.</p>
    {packs.map(p => <div key={p.id} className="rowflex" style={{ padding: "6px 0", borderBottom: "1px solid #eef2f7" }}><b>{p.name}</b><span className="muted">{p.services} services · {p.fields} fields</span><span style={{ flex: 1 }} /><button className="btn ghost small" onClick={() => apply(p.id)}>Apply pack</button></div>)}
    {msg && <div className="ok" style={{ marginTop: 8 }}>{msg}</div>}</div>);
}

function ActivationCard() {
  const [a, setA] = useState<any>(null);
  useEffect(() => { api("/api/admin/activation").then(setA).catch(() => {}); }, []);
  if (!a) return null;
  const labels: any = { has_leads: "Has leads", has_proposals: "Has proposals", has_decided_approval: "Approval decided", has_jobs: "Has jobs", has_won: "Has won work", has_team: "Team of 2+" };
  return (<div className="card"><h3 style={{ marginTop: 0 }}>Activation funnel — % of workspaces reaching each milestone</h3><div className="rowflex" style={{ gap: 18, flexWrap: "wrap" }}>{Object.entries(a.milestone_pct).map(([k, v]: any) => <span key={k}><b style={{ fontSize: 20 }}>{v}%</b><br /><span className="muted">{labels[k] || k}</span></span>)}</div></div>);
}

function SuppressionsCard() {
  const [list, setList] = useState<any[]>([]); const [kind, setKind] = useState("email"); const [value, setValue] = useState(""); const [reason, setReason] = useState(""); const [msg, setMsg] = useState("");
  const load = () => { api("/api/suppressions").then(setList).catch(() => {}); };
  useEffect(load, []);
  const add = async () => { try { await api("/api/suppressions", { method: "POST", body: { kind, value, reason } }); setValue(""); setReason(""); setMsg("Added — sends to this address stop everywhere, cadences included."); load(); } catch (e: any) { setMsg(e.message); } };
  return (<div className="card"><h3>🚫 Suppression list</h3><p className="muted" style={{ marginTop: 0 }}>Unsubscribes and do-not-contacts. Every send — manual, cadence, first touch — checks this list at the door; suppressed sends are recorded as <b>suppressed</b>, never as sent, and an active cadence stops with reason <i>suppressed</i>.</p>
    {list.map(x => <div key={x.id} className="rowflex" style={{ padding: "5px 0", borderBottom: "1px solid #eef2f7" }}><span className="chip">{x.kind}</span><b>{x.value}</b><span className="muted">{x.reason || x.source} · {dt(x.created_at)}</span><span style={{ flex: 1 }} /><button className="btn ghost small" onClick={async () => { await api(`/api/suppressions/${x.id}`, { method: "DELETE" }); load(); }}>Remove</button></div>)}
    {list.length === 0 && <p className="muted">Nobody is suppressed yet.</p>}
    <div className="rowflex"><select value={kind} onChange={e => setKind(e.target.value)} style={{ width: 100 }}><option value="email">Email</option><option value="phone">Phone</option></select><input placeholder={kind === "email" ? "person@company.com" : "(631) 555-0100"} value={value} onChange={e => setValue(e.target.value)} style={{ flex: 1 }} /><input placeholder="Reason (unsubscribed, wrong number…)" value={reason} onChange={e => setReason(e.target.value)} style={{ flex: 1 }} /><button className="btn small" disabled={!value.trim()} onClick={add}>Suppress</button></div>
    {msg && <div className="ok" style={{ marginTop: 8 }}>{msg}</div>}</div>);
}

function PeriodsStrip() {
  const [p, setP] = useState<any>(null);
  useEffect(() => { api("/api/metrics/periods").then(setP).catch(() => {}); }, []);
  if (!p) return null;
  const cell = (label: string, k: string, fmt: (n: number) => string) => { const a = p.this_week[k] || 0, b = p.last_week[k] || 0; const d = a - b; return (<span key={k}><b style={{ fontSize: 17 }}>{fmt(a)}</b> <span className="muted">{label}</span> <span style={{ color: d > 0 ? "#157347" : d < 0 ? "#b3261e" : "#5b6b62" }}>{d > 0 ? `▲ ${fmt(d)}` : d < 0 ? `▼ ${fmt(-d)}` : "—"} vs last wk</span></span>); };
  return (<div className="card" style={{ marginTop: 12 }}><b>📅 This week vs last week</b><div className="rowflex" style={{ gap: 22, flexWrap: "wrap", marginTop: 8 }}>{cell("new leads", "leads_created", n => String(n))}{cell("proposals sent", "proposals_sent", n => String(n))}{cell("won", "won", n => String(n))}{cell("jobs created", "jobs_created", n => String(n))}{cell("signed value", "signed_value", n => money(n))}</div></div>);
}

function PlaybookCard() {
  const [cfg, setCfg] = useState<any>(null); const [rules, setRules] = useState(""); const [note, setNote] = useState(""); const [open, setOpen] = useState(false);
  useEffect(() => { api("/api/agent/config").then((r: any) => { setCfg(r); setRules(r.custom_instructions || ""); }).catch(() => {}); }, []);
  if (!cfg) return null;
  const CB2: Record<string, string> = { read: "#e0f2fe", draft: "#fef9c3", execute: "#dcfce7", approval: "#fee2e2" };
  return (<div className="card" style={{ marginTop: 14 }}><h3 style={{ marginTop: 0 }}>📖 Agent playbook <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>— exactly what the agent is told, and the full locked tool list. Nothing hidden.</span></h3>
    <button className="btn ghost small" onClick={() => setOpen(!open)}>{open ? "Hide" : "Show"} system prompt + {cfg.tools.length} tools</button>
    {open && <div style={{ marginTop: 10 }}><pre style={{ whiteSpace: "pre-wrap", background: "#f8fafc", borderRadius: 8, padding: 10, fontSize: 12.5, margin: 0 }}>{cfg.system_prompt}</pre>
    <table style={{ marginTop: 10 }}><thead><tr><th>Tool</th><th>Control</th><th>What it does</th></tr></thead><tbody>{cfg.tools.map((t: any) => <tr key={t.name}><td><b>{t.name}</b></td><td><span className="tinyBadge" style={{ background: CB2[t.control] || "#e2e8f0" }}>{t.control}</span></td><td className="muted" style={{ fontSize: 12.5 }}>{t.description}</td></tr>)}</tbody></table></div>}
    <h4 style={{ margin: "14px 0 4px" }}>House rules <span className="muted" style={{ fontWeight: 400, fontSize: 12.5 }}>— your standing instructions; appended to the agent's prompt when a provider is connected</span></h4>
    <textarea rows={3} style={{ width: "100%" }} value={rules} onChange={e => setRules(e.target.value)} placeholder="e.g. Always offer a site visit before quoting tank work. Never schedule on Sundays. Escalate anything over $25k to Gregory." />
    <div className="rowflex" style={{ marginTop: 6 }}><button className="btn small" onClick={async () => { await api("/api/agent/config", { method: "PATCH", body: { custom_instructions: rules } }); setNote("Saved ✓ — applies to the next agent run."); }}>Save house rules</button>{note && <span className="ok">{note}</span>}</div>
  </div>);
}

function ProviderCard() {
  const [st, setSt] = useState<any>(null); const [kind, setKind] = useState("anthropic"); const [model, setModel] = useState(""); const [key, setKey] = useState(""); const [msg, setMsg] = useState("");
  const load = () => { api("/api/ai/provider").then((r: any) => { setSt(r); if (r.model) setModel(r.model); if (r.kind && r.kind !== "rules") setKind(r.kind); }).catch(() => {}); };
  useEffect(load, []);
  const save = async () => { const r = await api("/api/ai/provider", { method: "PATCH", body: { provider: kind, model: model || undefined, api_key: key === "" ? undefined : key } }); setSt(r); setKey(""); setMsg("Provider settings saved ✓"); };
  const test = async () => { setMsg("Testing…"); const r = await api("/api/ai/provider/test", { method: "POST", body: {} }).catch((e: any) => ({ ok: false, error: e.message })); setMsg(r.ok ? (r.mode === "rules" ? r.message : `Connected ✓ ${r.model} responded in ${r.latency_ms}ms`) : "Failed: " + (r.error || "unknown")); };
  return (<div className="card" style={{ marginBottom: 14 }}><h3 style={{ marginTop: 0 }}>🧠 AI provider</h3>
    <p className="sub" style={{ marginTop: 0 }}>{st ? (st.configured ? <>Connected: <b>{st.label}</b>. The agent plans with the model; Workpile's policy engine still decides what may execute.</> : <>No provider connected — the agent runs on the deterministic rules planner and labels its output as such. Add a key to enable generative planning and drafting.</>) : "…"}</p>
    <div className="grid2"><label>Provider<select value={kind} onChange={e => setKind(e.target.value)}><option value="anthropic">Anthropic (Claude)</option><option value="openai">OpenAI</option></select></label>
    <label>Model<input value={model} onChange={e => setModel(e.target.value)} placeholder={kind === "anthropic" ? "claude-sonnet-4-5" : "gpt-5"} /></label>
    <label>API key<input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder={st?.source === "workspace" ? "•••••••• (saved — leave blank to keep)" : "sk-…"} /></label></div>
    <div className="rowflex" style={{ marginTop: 10 }}><button className="btn small" onClick={save}>Save provider</button><button className="btn ghost small" onClick={test}>Test connection</button>{st?.source === "workspace" && <button className="btn ghost small" onClick={async () => { await api("/api/ai/provider", { method: "PATCH", body: { api_key: "" } }); load(); setMsg("Workspace key removed."); }}>Remove workspace key</button>}{msg && <span className="muted">{msg}</span>}</div>
  </div>);
}

function AutonomyCard() {
  const [a, setA] = useState<any>(null); const [msg, setMsg] = useState("");
  const load = () => { api("/api/ai/autonomy").then(setA).catch(() => {}); };
  useEffect(load, []);
  if (!a) return null;
  const pick = async (lvl: number) => { try { const r = await api("/api/ai/autonomy", { method: "PATCH", body: { level: lvl } }); setMsg(`Level set — L${r.level} ${r.level_name}`); load(); } catch (e: any) { setMsg(e.message); } };
  return (<div className="card"><h3>🎚 Agent autonomy — L{a.level} · {a.level_name}</h3><p className="muted" style={{ marginTop: 0 }}>How far the agent may go on its own in this workspace{a.explicit ? "" : " (default level — set one to make it explicit)"}. The armed automations decide <i>what</i> it works on; this decides <i>how far</i> it goes. Every run is logged either way.</p>
    {a.levels.map((l: any) => <label key={l.level} className="check" style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: "1px solid #eef2f7", cursor: "pointer" }}><input type="radio" style={{ width: "auto", marginTop: 2 }} name="autonomy" checked={a.level === l.level} onChange={() => pick(l.level)} /><span><b>L{l.level} — {l.name}</b><br /><span className="muted">{l.summary}</span></span></label>)}
    {msg && <div className="ok" style={{ marginTop: 8 }}>{msg}</div>}</div>);
}

function AgentMetricsCard() {
  const [m, setM] = useState<any>(null);
  useEffect(() => { api("/api/ai/metrics").then(setM).catch(() => {}); }, []);
  if (!m) return null;
  const runs = Object.values(m.runs_30d || {}).reduce((a: number, b: any) => a + Number(b || 0), 0) as number;
  return (<div className="card"><h3>📈 Agent acceptance — last 30 days</h3>
    <div className="rowflex" style={{ gap: 18, flexWrap: "wrap" }}>
      <span><b style={{ fontSize: 20 }}>{runs}</b><br /><span className="muted">agent runs</span></span>
      <span><b style={{ fontSize: 20 }}>{m.actions_applied_30d}</b><br /><span className="muted">actions applied</span></span>
      <span><b style={{ fontSize: 20 }}>{m.fpar === null ? "—" : m.fpar + "%"}</b><br /><span className="muted">first-pass approval ({m.approvals_decided} decided)</span></span>
      <span><b style={{ fontSize: 20 }}>{m.merges_30d}</b><br /><span className="muted">duplicate merges</span></span>
      <span><b style={{ fontSize: 20 }}>~{m.est_minutes_saved_30d} min</b><br /><span className="muted">time saved</span></span>
    </div>
    <p className="muted" style={{ marginBottom: 0, fontSize: 12 }}>{m.time_saved_basis}</p></div>);
}

function QuietHoursCard() {
  const [q, setQ] = useState<any>(null); const [msg, setMsg] = useState("");
  useEffect(() => { api("/api/settings/cadence").then(setQ).catch(() => {}); }, []);
  if (!q) return null;
  const save = async () => { await api("/api/settings/cadence", { method: "PATCH", body: { quiet_start: q.quiet_start === "" ? null : q.quiet_start, quiet_end: q.quiet_end === "" ? null : q.quiet_end, tz: q.tz } }); setMsg("Saved ✓ — follow-ups will pause inside the window"); };
  return (<div className="card"><h3>🌙 Follow-up quiet hours</h3><p className="muted" style={{ marginTop: 0 }}>Automated follow-ups never send inside this window (workspace time). Sends defer — they are never dropped. Leave blank to disable.</p>
    <div className="rowflex"><label>From hour <input type="number" min={0} max={23} style={{ width: 70 }} value={q.quiet_start ?? ""} onChange={e => setQ({ ...q, quiet_start: e.target.value === "" ? null : Number(e.target.value) })} placeholder="21" /></label><label>To hour <input type="number" min={0} max={23} style={{ width: 70 }} value={q.quiet_end ?? ""} onChange={e => setQ({ ...q, quiet_end: e.target.value === "" ? null : Number(e.target.value) })} placeholder="7" /></label><label>Timezone <input style={{ width: 180 }} value={q.tz || ""} onChange={e => setQ({ ...q, tz: e.target.value })} /></label><button className="btn small" onClick={save}>Save</button>{msg && <span className="ok">{msg}</span>}</div></div>);
}

function Landing({ onAuth }: any) {
  const qs = new URLSearchParams(location.search);
  const [mode, setMode] = useState<"home" | "login" | "register" | "forgot" | "reset">(qs.get("reset") ? "reset" : "home");
  const [resetToken] = useState(qs.get("reset") || ""); const [authNote, setAuthNote] = useState("");
  useEffect(() => { const v = qs.get("verify"); if (v) { api("/api/auth/verify", { method: "POST", body: { token: v } }).then(() => { setAuthNote("Email verified \u2713 \u2014 sign in to continue."); setMode("login"); }).catch(() => { setAuthNote("That verification link is invalid or expired."); setMode("login"); }); } }, []);
  const [f, setF] = useState<any>({ name: "", email: "", password: "", business_name: "" });
  const [err, setErr] = useState("");
  const submit = async () => { try { setErr(""); const r = mode === "register" ? await api("/api/auth/register", { method: "POST", body: f }) : await api("/api/auth/login", { method: "POST", body: { email: f.email, password: f.password } }); onAuth(r.user); } catch (e: any) { setErr(e.message); } };
  if (mode !== "home") return (<div className="authWrap">
    <div className="authBrand"><Logo light /><h2>The backlog ends here.</h2><p>Every lead owned, every packet complete before it reaches you, every proposal priced from your own book — and every final outcome delivered into the system you already run.</p>
      {[["Completeness Gate", "Nothing reaches approval half-empty — that's how owners hit 90%+ first-pass approvals."], ["AI that does the chasing", "Lead scoring, duplicate cleanup, auto-assignment, stale-lead reactivation — you approve, it executes."], ["Your system stays the boss", "Won becomes a project in YOUR platform, acknowledged with your ID. Lost and N/A delivered too."]].map(([t, d]) => <div className="pt" key={t}><span>✓</span><div><b style={{ color: "#fff" }}>{t}</b><br />{d}</div></div>)}
    </div>
    <div className="authForm"><div className="authCard">
      <button className="btn ghost small" onClick={() => setMode("home")}>← Back</button>
      {mode === "forgot" && <><h3 style={{ marginTop: 16 }}>Reset your password</h3><p className="muted">We'll email you a one-hour reset link.</p>{authNote && <div className="ok" style={{ marginBottom: 8 }}>{authNote}</div>}
        <label className="f">Work email</label><input value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="you@company.com" />
        <button className="btn" style={{ width: "100%", marginTop: 12, padding: 12 }} onClick={async () => { const r = await api("/api/auth/forgot", { method: "POST", body: { email: f.email } }).catch((e: any) => ({ error: e.message })); if (r.reset_url) setAuthNote("Test mode (no email provider configured): use this link \u2014 " + r.reset_url); else setAuthNote(r.error ? r.error : "If that email has an account, a reset link is on its way."); }}>Send reset link \u2192</button>
        <p className="muted" style={{ fontSize: 13, marginTop: 12 }}><a href="#" onClick={e => { e.preventDefault(); setMode("login"); }}>Back to sign in</a></p></>}
      {mode === "reset" && <><h3 style={{ marginTop: 16 }}>Choose a new password</h3>{authNote && <div className="ok" style={{ marginBottom: 8 }}>{authNote}</div>}{err && <div className="err">{err}</div>}
        <label className="f">New password</label><input type="password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} placeholder="8+ characters" />
        <button className="btn" style={{ width: "100%", marginTop: 12, padding: 12 }} onClick={async () => { try { await api("/api/auth/reset", { method: "POST", body: { token: resetToken, password: f.password } }); setAuthNote("Password updated \u2014 sign in with it now."); setMode("login"); history.replaceState({}, "", "/app"); } catch (e: any) { setErr(e.message); } }}>Update password</button></>}
      {mode !== "forgot" && mode !== "reset" && <><h3 style={{ marginTop: 16 }}>{mode === "register" ? "Start your 30-day free trial" : "Welcome back"}</h3>
      <p className="muted">{mode === "register" ? "No card required. Your workspace, price book, and templates are created for you." : "Sign in to your workspace."}</p>{authNote && mode === "login" && <div className="ok" style={{ marginBottom: 8 }}>{authNote}</div>}
      {err && <div className="err">{err}</div>}
      {mode === "register" && <><label className="f">Your name</label><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Jordan Ellis" /><label className="f">Business name</label><input value={f.business_name} onChange={e => setF({ ...f, business_name: e.target.value })} placeholder="Ellis Restoration Group" /></>}
      <label className="f">Work email</label><input value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="you@company.com" />
      <label className="f">Password</label><input type="password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} placeholder={mode === "register" ? "8+ characters" : "Your password"} />
      <button className="btn" style={{ width: "100%", marginTop: 12, padding: 12 }} onClick={submit}>{mode === "register" ? "Create my workspace →" : "Sign in →"}</button>
      <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>{mode === "register" ? <>Already have an account? <a href="#" onClick={e => { e.preventDefault(); setMode("login"); }}>Sign in</a></> : <>New to Workpile? <a href="#" onClick={e => { e.preventDefault(); setMode("register"); }}>Start free trial</a> · <a href="#" onClick={e => { e.preventDefault(); setMode("forgot"); }}>Forgot password?</a></>}</p>
      <p className="muted" style={{ fontSize: 12.5 }}>Demo workspace: owner@demo.test / demo1234</p></>}
    </div></div></div>);
  const FEATS: [string, string, string][] = [
    ["🧹", "Backlog Clear", "Import or sync years of piled-up leads. AI triages, dedupes, scores, and buckets them hot / warm / stale with a projected clear date."],
    ["✅", "One-Tap Approvals", "Only complete packets reach you — contact, scope, site visit, PM, price-book pricing verified by the Completeness Gate. Approve in 10 seconds."],
    ["📄", "Generative Proposals", "Proposals drafted from your templates and your price book. Never an invented number; below-floor pricing flags itself."],
    ["🤖", "AI Operations", "Lead scoring, duplicate archiving, spam filtering, round-robin auto-assignment, stale-lead reactivation, and a 6 AM Morning Brief."],
    ["🔁", "Final Outcome Handoff", "Won becomes a project in your own platform — pull API, signed webhooks, acknowledgment tracking. Lost, no-response, and N/A delivered too."],
    ["📈", "Demand Gap", "See the services customers keep asking for that you don't sell yet, clustered and valued from your own lost leads."],
    ["✍️", "E-Sign + Deposits", "Signed proposal links with ESIGN evidence certificates, and deposit collection via Stripe the moment they sign."],
    ["🏢", "Multi-Business Ready", "Multiple workspaces under one login, per-business price books, teams, and roles. Owners see everything; staff see their work."],
  ];
  return (<div className="lp">
    <nav className="lpNav"><Logo /><div className="lpLinks"><a href="#product">Product</a><a href="#agent">AI Agent</a><a href="#ops">Ops</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a></div><div className="lpNavCtas"><button className="btn ghost" onClick={() => setMode("login")}>Sign in</button><button className="btn" onClick={() => setMode("register")}>Start free</button></div></nav>

    <header className="lpHero">
      <p className="lpEyebrow">The Revenue Execution OS for field-service businesses</p>
      <h1>Turn every opportunity into <em>accountable work</em>.</h1>
      <p className="lpLede">Leads pile up in inboxes, spreadsheets, and somebody's memory. Workpile ends the pile: every lead owned, every proposal priced from your own book, every job scheduled with its crew — and an AI agent that does the chasing while a human approves anything that matters.</p>
      <div className="lpCtas"><button className="btn lpBig" onClick={() => setMode("register")}>Start 30-day free trial</button><a className="btn ghost lpBig" href="/audit">Run the free backlog audit →</a></div>
      <p className="lpMicro">No card required · Set up in minutes · Your data stays yours</p>
      <div className="lpShot"><img src="/shots/hero.png" alt="Workpile Work Queue with the AI agent panel" loading="eager" /><span className="lpChip lpChipA">✦ Agent — every send approved by a human</span><span className="lpChip lpChipB">Five money figures. Never blended.</span></div>
    </header>

    <div className="lpFacts">
      <div><b>L0–L4</b><span>agent autonomy — you set the level</span></div>
      <div><b>13</b><span>governed agent tools, each with a control class</span></div>
      <div><b>5</b><span>money figures, tracked separately — always</span></div>
      <div><b>10s</b><span>to approve a complete packet</span></div>
    </div>

    <section className="lpSec" id="product">
      <p className="lpKick">The Work Queue</p>
      <h2>One queue. Everything that needs a human, worst-first.</h2>
      <div className="lpSplit"><div>
        <p className="lpBody">Untouched leads, overdue follow-ups, approvals waiting, jobs that need crew, expiring paperwork — the Work Queue is the operational center of the business, not another dashboard you check on Fridays. Work it to zero, every day.</p>
        <ul className="lpList">
          <li><b>Untouched-lead triage in one click</b> — the agent qualifies, assigns, and drafts first touches in bulk; you approve the sends.</li>
          <li><b>The Completeness Gate</b> — nothing reaches your approval half-empty: contact, scope, site visit, owner, and price-book pricing verified first.</li>
          <li><b>Bulk actions</b> — assign, snooze, or task dozens of items at once. Approvals always stay individual.</li>
        </ul></div>
        <div className="lpShotSm"><img src="/shots/home.png" alt="Workpile Home with the working calendar" loading="lazy" /></div></div>
    </section>

    <section className="lpSec lpDark" id="agent">
      <p className="lpKick light">The AI Agent</p>
      <h2>An operator, not a chatbot. Accountable by design.</h2>
      <div className="lpSplit"><div className="lpShotSm"><img src="/shots/agent.png" alt="The Agent playbook — system prompt and locked tool list" loading="lazy" /></div><div>
        <p className="lpBody light">Tell it what to do — "handle all untouched leads", "recover customers who went quiet" — and it plans governed steps, runs what your autonomy level allows, and stops at your approval gates. Sends always need a human. Prices only ever come from your price book.</p>
        <ul className="lpList light">
          <li><b>The playbook is public</b> — the exact system prompt and all 18 tools, visible in your workspace. Nothing hidden.</li>
          <li><b>House rules</b> — your standing instructions ("never schedule Sundays", "escalate over $25k") ride along with every plan.</li>
          <li><b>Attribution</b> — every run records who asked, who decided, and what each step did. First-pass approval rate is measured, not vibes.</li>
        </ul></div></div>
    </section>

    <section className="lpSec" id="money">
      <p className="lpKick">Money, honestly</p>
      <h2>Five figures. Five meanings. Never blended.</h2>
      <p className="lpBody" style={{ maxWidth: 720 }}>Most CRMs show one pipeline number and call it revenue. Workpile keeps the five money concepts separate — with real invoices and true accounts receivable underneath, so "outstanding" always means money actually owed to you.</p>
      <div className="lpMoney">
        {[["Estimated pipeline", "What open leads might be worth"], ["Proposal value", "What you've actually quoted"], ["Signed contracts", "What customers agreed to"], ["Invoiced", "What you've billed — real invoices"], ["Collected cash", "What's in the bank"]].map(([t, d]) => <div className="lpMoneyCard" key={t}><b>{t}</b><span>{d}</span></div>)}
      </div>
    </section>

    <section className="lpSec" id="ops">
      <p className="lpKick">Jobs & Ops</p>
      <h2>Signed means scheduled. Scheduled means staffed.</h2>
      <div className="lpSplit"><div>
        <p className="lpBody">A won proposal becomes a real job with a lifecycle — awaiting scheduling, scheduled, in progress, documentation, ready to invoice, closed. Move a job to Scheduled and you pick the day and time right there: the crew lands on the Ops Console for that day and the week's timesheets open underneath. No separate scheduling ritual, no spreadsheet.</p>
        <ul className="lpList">
          <li><b>Conflicts warn, never block</b> — double-booked crew is flagged; you decide.</li>
          <li><b>Payroll-ready timesheets</b> — submitted → reviewed → approved → exported; only approved hours reach the payroll CSV.</li>
          <li><b>Paperwork queue</b> — required documents tracked per job, with expiring documents surfacing before they lapse.</li>
        </ul></div>
        <div className="lpShotSm"><img src="/shots/ops.png" alt="Ops Console — crew schedule and jobs starting this week" loading="lazy" /></div></div>
    </section>

    <section className="lpSec" id="how">
      <p className="lpKick">How it works</p>
      <h2>Live in an afternoon</h2>
      <div className="steps">
        <div className="step"><b>1</b><h4>Bring the pile</h4><p>Sync from your current system, upload the CSV, connect your inbox and website form. The agent dedupes, scores, and assigns everything it finds.</p></div>
        <div className="step"><b>2</b><h4>Approve & propose</h4><p>Work the queue, approve complete packets, send proposals generated from your price book. Customers e-sign and pay the deposit by card.</p></div>
        <div className="step"><b>3</b><h4>Run the work</h4><p>Jobs get scheduled with crew and timesheets; invoices go out; every final outcome — won, lost, no-response — is delivered back into your platform.</p></div>
      </div>
      <div className="featGrid" style={{ marginTop: 18 }}>{FEATS.map(([ic, t, d]) => <div className="feat" key={t}><div className="ic">{ic}</div><h4>{t}</h4><p>{d}</p></div>)}</div>
    </section>

    <section className="lpSec" id="compare">
      <p className="lpKick">Straight talk</p>
      <h2>Why teams switch from Salesforce</h2>
      <p className="lpBody" style={{ maxWidth: 720 }}>Salesforce is a database you configure for six months. Workpile is the workflow, finished — at a tenth of the seat cost.</p>
      <div className="tableWrap"><table className="cmp"><thead><tr><th></th><th>Workpile</th><th>Salesforce</th></tr></thead><tbody>
        {[["Backlog clearing & AI triage built in", 1, 0], ["Completeness Gate before approvals", 1, 0], ["Proposals generated from your price book", 1, 0], ["Final outcomes delivered into your other systems", 1, 0], ["Pipeline, Path, reports & dashboards", 1, 1], ["Live in an afternoon, no admin required", 1, 0], ["Per-seat pricing from $19.99/mo (annual)", 1, 0]].map(([t, a, b]: any) => <tr key={t}><td>{t}</td><td className={a ? "yes" : "no"}>{a ? "✓ Included" : "—"}</td><td className={b ? "yes" : "no"}>{b ? "✓" : "Add-on / custom build"}</td></tr>)}
      </tbody></table></div>
    </section>

    <section className="lpSec" id="verticals">
      <p className="lpKick">Built for your trade</p>
      <h2>Starts with your services, your paperwork, your words</h2>
      <p className="lpBody" style={{ maxWidth: 720 }}>Vertical packs load a workspace with the trade's services, document requirements, and proposal language — environmental contracting is the flagship, with more trades on the same rails.</p>
      <div className="lpVerts"><span>🌎 Environmental</span><span>🔧 Plumbing & HVAC</span><span>🏠 Roofing</span><span>💧 Restoration</span><span>+ your trade, configured</span></div>
    </section>

    <section className="lpSec" id="pricing">
      <p className="lpKick">Pricing</p>
      <h2>Per workspace. 30 days free. No card.</h2>
      <p className="lpBody" style={{ maxWidth: 720 }}>Trials start on the Pro plan so you see everything. Prices are per workspace, billed annually — and field crew on the roster are always free.</p>
      <PlanCards onAction={() => setMode("register")} />
    </section>

    <section className="lpBand">
      <h2>Not sure yet? Bring us your worst spreadsheet.</h2>
      <p>The free backlog audit takes two minutes: drop in your lead list and see what the pile is worth, what's stale, and what to work first. Your rows are never stored — you get aggregates, we keep nothing.</p>
      <a className="btn lpBig lpBandBtn" href="/audit">Run the free backlog audit →</a>
    </section>

    <section className="lpSec" id="faq">
      <p className="lpKick">Questions</p>
      <h2>Asked by owners like you</h2>
      {[["Do I have to replace my current system?", "No — Workpile is the front door, not the house. Won jobs become projects in YOUR platform via API or webhooks; every final outcome is delivered and acknowledged there."], ["How do leads get in?", "Four ways: sync from your lead system's API by date range (daily auto-sync available), CSV upload, website form embed with TCPA consent, and inbox/API ingestion."], ["Is the AI allowed to send things on its own?", "Never. The agent drafts, scores, and organizes; every customer-facing send needs a human approval, and pricing only ever comes from your price book. That's a product invariant, not a setting."], ["Can the agent text customers without consent?", "No. Consent is enforced at the single send boundary — a text to a lead without recorded consent is blocked before it queues, whoever or whatever requested it."], ["What happens to duplicates?", "Ingestion dedupes by phone/email automatically. The agent's cleanup finds the rest — same name + service — and merges are recorded and reversible."], ["What does pricing meter?", "Your workspace and its active requests — leads that aren't closed yet. Office users are included per tier; field crew on the roster (timesheets, schedules) never cost anything. And hitting your request allowance never blocks a new lead from coming in — it just starts an upgrade conversation."]].map(([q, a]) => <div className="faq" key={q}><b>{q}</b><p>{a}</p></div>)}
    </section>

    <footer className="lpFoot"><div className="lpFootIn"><Logo light /><p>Turn every opportunity into accountable work.</p><span>© 2026 Workpile · <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · <a href="/dpa">DPA</a> · <a href="/audit">Free backlog audit</a></span><span>Built for the businesses that answer the phone.</span></div></footer>
    <div className="lpSticky"><button className="btn" onClick={() => setMode("register")}>Start free — 30 days</button><a className="btn ghost" href="/audit">Free audit</a></div>
  </div>);
}

function RichText({ value, onChange, minH }: any) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value || ""; }, []);
  const cmd = (c: string, v?: string) => { document.execCommand(c, false, v); ref.current?.focus(); };
  const insert = (t: string) => { document.execCommand("insertText", false, t); ref.current?.focus(); };
  return (<div>
    <div className="rowflex" style={{ gap: 4, marginBottom: 4 }}>
      <button type="button" className="btn ghost small" onClick={() => cmd("bold")}><b>B</b></button>
      <button type="button" className="btn ghost small" onClick={() => cmd("italic")}><i>I</i></button>
      <button type="button" className="btn ghost small" onClick={() => cmd("underline")}><u>U</u></button>
      <button type="button" className="btn ghost small" onClick={() => cmd("formatBlock", "h3")}>Heading</button>
      <button type="button" className="btn ghost small" onClick={() => cmd("insertUnorderedList")}>• List</button>
      <button type="button" className="btn ghost small" onClick={() => { const u = prompt("Image URL (https://…)"); if (u) { cmd("insertHTML", `<img src="${u.replaceAll('"', "")}" style="max-width:100%">`); onChange(ref.current?.innerHTML || ""); } }}>🖼 URL</button>
      <button type="button" className="btn ghost small" onClick={() => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.onchange = () => { const f = inp.files?.[0]; if (!f) return; const img = new Image(); img.onload = () => { const c = document.createElement("canvas"); const sc = Math.min(1, 900 / img.width); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc); c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height); cmd("insertHTML", `<img src="${c.toDataURL("image/jpeg", 0.82)}" style="max-width:100%">`); onChange(ref.current?.innerHTML || ""); }; img.src = URL.createObjectURL(f); }; inp.click(); }}>🖼 Upload</button>
      <span className="muted" style={{ marginLeft: 6 }}>Insert:</span>
      {["{customer}", "{service}", "{total}", "{date}", "{ref}", "{business}", "{location}"].map(f => <button type="button" key={f} className="btn ghost small" onClick={() => insert(f)}>{f}</button>)}
    </div>
    <div ref={ref} contentEditable suppressContentEditableWarning className="richtext" style={{ minHeight: minH || 110 }} onBlur={() => onChange(ref.current?.innerHTML || "")} />
  </div>);
}

function DocTemplatesEditor() {
  const [list, setList] = useState<any[]>([]); const [selId, setSelId] = useState(""); const [form, setForm] = useState<any>(null);
  const [head, setHead] = useState<any>(null); const [msg, setMsg] = useState(""); const [showPrev, setShowPrev] = useState(false);
  const load = async (keep?: string) => { const l = await api("/api/doc-templates").catch(() => []); setList(l); const pick = l.find((t: any) => t.id === (keep || selId)) || l.find((t: any) => t.is_default) || l[0]; if (pick) { setSelId(pick.id); setForm({ name: pick.name, intro_html: pick.intro_html, terms_html: pick.terms_html, footer: pick.footer, include_logo: !!pick.include_logo, applies_to: pick.applies_to || "" }); } };
  const [svcs, setSvcs] = useState<any[]>([]);
  useEffect(() => { load(); api("/api/proposal-template").then(setHead).catch(() => {}); api("/api/services").then(setSvcs).catch(() => {}); }, []);
  const sel = list.find(t => t.id === selId);
  const sample = (h: string) => String(h || "").replaceAll("{customer}", "Angela Ruiz").replaceAll("{service}", "Mold remediation").replaceAll("{total}", "$4,800.00").replaceAll("{date}", "Nov 10, 2026").replaceAll("{ref}", "PROP-1001").replaceAll("{business}", head?.company || "Your Company").replaceAll("{location}", "Bay Shore, NY");
  const pickFile = (cb: (d: string) => void, maxW = 480) => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.onchange = () => { const f = inp.files?.[0]; if (!f) return; const img = new Image(); img.onload = () => { const c = document.createElement("canvas"); const sc = Math.min(1, maxW / img.width); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc); c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height); cb(c.toDataURL("image/png")); }; img.src = URL.createObjectURL(f); }; inp.click(); };
  if (!form || !head) return <p className="muted">Loading templates…</p>;
  return (<div>
    <h3 style={{ marginTop: 0 }}>Proposal templates — a variety, not just one</h3>
    <p className="muted">Every proposal picks a template when it's built — different words for a homeowner, a school district, or a government bid. The header (company, logo) is shared; intro, terms, and footer live on each template. Printouts, DOCX, and the customer's sign page all render the chosen template.</p>
    {msg && <div className="ok">{msg}</div>}
    <div className="card" style={{ background: "#f8fafc" }}><b>Company header & logo (shared by all templates)</b>
      <div className="formgrid" style={{ marginTop: 8 }}>
        <div><label className="f">Company name</label><input value={head.company || ""} onChange={e => setHead({ ...head, company: e.target.value })} /></div>
        <div><label className="f">Tagline</label><input value={head.tagline || ""} onChange={e => setHead({ ...head, tagline: e.target.value })} /></div>
        <div><label className="f">Contact line</label><input value={head.contact_line || ""} onChange={e => setHead({ ...head, contact_line: e.target.value })} /></div>
        <div><label className="f">Address line</label><input value={head.address || ""} onChange={e => setHead({ ...head, address: e.target.value })} /></div>
      </div>
      <div className="rowflex" style={{ marginTop: 10 }}>{head.logo ? <img src={head.logo} alt="logo" style={{ maxHeight: 54, maxWidth: 200, border: "1px solid #e5e7eb", borderRadius: 6, padding: 4, background: "#fff" }} /> : <span className="muted">No logo yet</span>}
        <button className="btn ghost small" onClick={() => pickFile(d => setHead({ ...head, logo: d }))}>{head.logo ? "Replace logo" : "Upload logo"}</button>
        {head.logo && <button className="btn ghost small" onClick={() => setHead({ ...head, logo: null })}>Remove</button>}
        <button className="btn small" onClick={async () => { const r = await api("/api/proposal-template", { method: "PUT", body: { company: head.company, tagline: head.tagline, contact_line: head.contact_line, address: head.address, intro_html: head.intro_html || "", terms_html: head.terms_html || "", footer: head.footer || "", logo_data: head.logo ?? null } }); setHead(r); setMsg("Header & logo saved ✓"); }}>Save header & logo</button></div>
    </div>
    <div className="rowflex" style={{ margin: "14px 0 8px" }}>
      {list.map(t => <button key={t.id} className={`chip ${selId === t.id ? "on" : ""}`} onClick={() => { setSelId(t.id); setForm({ name: t.name, intro_html: t.intro_html, terms_html: t.terms_html, footer: t.footer, include_logo: !!t.include_logo }); }}>{t.name}{t.is_default ? " ⭐ default" : ""}</button>)}
      <button className="btn ghost small" onClick={async () => { const t = await api("/api/doc-templates", { method: "POST", body: { name: "New template" } }); await load(t.id); setMsg("Template added — make it yours and save"); }}>+ New</button>
      <button className="btn ghost small" onClick={async () => { const t = await api("/api/doc-templates", { method: "POST", body: { from_id: selId } }); await load(t.id); setMsg("Duplicated ✓"); }}>Duplicate</button>
      {list.length > 1 && <button className="btn ghost small" onClick={async () => { if (!confirm(`Delete "${sel?.name}"? Proposals already built keep the template they were built with in their history.`)) return; await api("/api/doc-templates/" + selId, { method: "DELETE" }); setSelId(""); await load(""); setMsg("Deleted ✓"); }}>Delete</button>}
    </div>
    <div className="formgrid">
      <div><label className="f">Template name</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
      <div><label className="f">Auto-use for service (smart picker)</label><select value={form.applies_to || ""} onChange={e => setForm({ ...form, applies_to: e.target.value })}><option value="">— No auto-match (default / manual only)</option>{svcs.map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}</select><p className="muted" style={{ marginTop: 4 }}>When a lead requests this service, this template is preselected in the proposal builder — and used by the AI drafter. Anyone can still pick a different template while composing.</p></div>
      <div><label className="f">Logo on this template</label><label className="check" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}><input type="checkbox" style={{ width: "auto" }} checked={!!form.include_logo} onChange={e => setForm({ ...form, include_logo: e.target.checked })} /> Print the company logo at the top</label></div>
      <div className="full"><label className="f">Intro — above the line items</label><RichText value={form.intro_html} onChange={(v: string) => setForm({ ...form, intro_html: v })} /></div>
      <div className="full"><label className="f">Terms & conditions — below the total</label><RichText value={form.terms_html} onChange={(v: string) => setForm({ ...form, terms_html: v })} /></div>
      <div className="full"><label className="f">Footer</label><input value={form.footer} onChange={e => setForm({ ...form, footer: e.target.value })} /></div>
    </div>
    <div className="rowflex" style={{ marginTop: 10 }}>
      <button className="btn" onClick={async () => { const t = await api("/api/doc-templates/" + selId, { method: "PATCH", body: form }); await load(t.id); setMsg("Template saved ✓ — pick it when building a proposal"); }}>Save template</button>
      {!sel?.is_default && <button className="btn ghost" onClick={async () => { await api("/api/doc-templates/" + selId, { method: "PATCH", body: { is_default: true } }); await load(selId); setMsg("Set as the default ✓ — new proposals preselect it"); }}>⭐ Make default</button>}
      <button className="btn ghost" onClick={() => setShowPrev(!showPrev)}>{showPrev ? "Hide preview" : "Preview with sample data"}</button>
    </div>
    {showPrev && <div className="printdoc" style={{ marginTop: 14, border: "1px solid #dbe4ee" }}>
      <div className="pd-head">{form.include_logo && head.logo && <img src={head.logo} alt="" style={{ maxHeight: 60, maxWidth: 220, marginBottom: 6 }} />}<div className="pd-company">{head.company}</div>{head.tagline && <div className="pd-tag">{head.tagline}</div>}{head.contact_line && <div className="pd-meta">{head.contact_line}</div>}{head.address && <div className="pd-meta">{head.address}</div>}</div>
      <h2>Proposal — Mold remediation · PROP-1001</h2>
      <p className="pd-meta">Prepared for: Angela Ruiz · Bay Shore, NY · Nov 10, 2026 · Template: {form.name}</p>
      <div dangerouslySetInnerHTML={{ __html: sample(form.intro_html) }} />
      <table className="pd-table"><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody><tr><td>Mold remediation — primary bath</td><td>1</td><td>$3,900.00</td><td>$3,900.00</td></tr><tr><td>HEPA air scrubber (per day)</td><td>3</td><td>$300.00</td><td>$900.00</td></tr></tbody></table>
      <p className="pd-total">Total: $4,800.00</p>
      <h3>Terms & Conditions</h3><div dangerouslySetInnerHTML={{ __html: sample(form.terms_html) }} />
      <p className="pd-sign">Signature: ______________________________&nbsp;&nbsp;Name (print): ______________________________&nbsp;&nbsp;Date: ______________</p>
      <div className="pd-foot">{sample(form.footer)}</div>
    </div>}
  </div>);
}
function PrintStatusReport() {
  const [r, setR] = useState<any>(null); const [ws, setWs] = useState<any>(null);
  useEffect(() => { const wk = new URLSearchParams(location.search).get("week") || ""; api("/api/status-report" + (wk ? "?week=" + wk : "")).then(setR).catch(() => {}); api("/api/settings").then(x => setWs(x.workspace)).catch(() => {}); }, []);
  useEffect(() => { if (r) { const t = setTimeout(() => window.print(), 600); return () => clearTimeout(t); } }, [r]);
  if (!r) return <div className="printdoc">Loading report…</div>;
  const Row = ({ k, v }: any) => <div className="pd-row"><span>{k}</span><b>{v}</b></div>;
  return (<div className="printdoc">
    <div className="pd-head"><div><h1>{ws?.name || "Weekly Status Report"}</h1><p>Weekly Status Report — week of {r.week_of} to {r.week_to}</p></div></div>
    <h3>Pipeline</h3>
    <Row k="New leads in" v={r.new_leads} /><Row k="Backlog still open" v={`${r.backlog.open} (${money(r.backlog.pipeline_value)} in pipeline)`} />
    <Row k="Proposals created" v={`${r.proposals.count} (${money(r.proposals.value)})`} /><Row k="Won" v={`${r.won.count} (${money(r.won.value)})`} />
    <Row k="Lost / No response" v={`${r.lost.count} / ${r.no_response}`} /><Row k="Approvals" v={`${r.approvals.decided} decided · ${r.approvals.rate ?? "—"}% approved · ${r.approvals.pending} waiting`} />
    <h3>Field & Labor</h3>
    <Row k="Field reports filed" v={`${r.field_reports.filed}/${r.field_reports.expected} (${r.field_reports.pct ?? "—"}%)`} />
    <Row k="Timesheets submitted" v={`${r.timesheets.submitted}/${r.timesheets.expected} (${r.timesheets.pct ?? "—"}%)`} />
    <Row k="Labor" v={`${r.labor.hours} hours · ${money(r.labor.cost)} across ${r.labor.jobs} jobs`} />
    <Row k="Crew assignments" v={r.scheduled.assignments} />
    {(r.top_jobs || []).map((j: any, i: number) => <Row key={i} k={`· ${j.service_requested} — ${j.customer || ""}`} v={`${j.h}h / ${money(j.a)}`} />)}
    <h3>Office</h3>
    <Row k="Inbox received / cleared" v={`${r.inbox.received} / ${r.inbox.cleared} (${r.inbox.open_now} still open)`} />
    <Row k="Final outcomes undelivered" v={r.handoffs_undelivered} />
    <p className="pd-foot">Generated by Workpile from live data — no hand-kept spreadsheet.</p>
  </div>);
}

function PrintProposal({ id }: any) {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState("");
  useEffect(() => { api("/api/proposals/" + id + "/document").then((r: any) => { setD(r); setTimeout(() => window.print(), 600); }).catch((e: any) => setErr(e.message || "Could not load — sign in first, then reopen this page.")); }, [id]);
  if (err) return <div style={{ padding: 40 }}><h2>Proposal</h2><p>{err}</p><p><a href="/app">Go to Workpile</a></p></div>;
  if (!d) return <div style={{ padding: 40 }}>Loading proposal…</div>;
  const t = d.template;
  return (<div className="printdoc">
    <div className="noprint" style={{ marginBottom: 16 }}><button className="btn" onClick={() => window.print()}>🖨 Print / Save as PDF</button> <button className="btn ghost" onClick={() => window.close()}>Close</button></div>
    <div className="pd-head">{t.logo && <img src={t.logo} alt="" style={{ maxHeight: 64, maxWidth: 240, marginBottom: 6 }} />}<div className="pd-company">{t.company}</div>{t.tagline && <div className="pd-tag">{t.tagline}</div>}{t.contact_line && <div className="pd-meta">{t.contact_line}</div>}{t.address && <div className="pd-meta">{t.address}</div>}</div>
    <h2>Proposal — {d.lead.service_requested} · {d.ref}</h2>{t.name && <p className="pd-meta">Template: {t.name}</p>}
    <p className="pd-meta">Prepared for: {d.contact.name} ({d.contact.email || ""} {d.contact.phone || ""}) · Location: {d.lead.location || ""} · Date: {new Date(d.proposal.created_at).toLocaleDateString()} · Version {d.proposal.version}</p>
    <div dangerouslySetInnerHTML={{ __html: t.intro_html }} />
    {d.lead.notes && <><h3>Scope</h3><p style={{ whiteSpace: "pre-wrap" }}>{d.lead.notes}</p></>}
    <table className="pd-table"><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>
      {d.items.map((i: any, k: number) => <tr key={k}><td>{i.name}</td><td>{i.qty || 1}</td><td>${Number(i.unit_price).toFixed(2)}</td><td>${(i.unit_price * (i.qty || 1)).toFixed(2)}</td></tr>)}
    </tbody></table>
    <p className="pd-total">Total: ${Number(d.proposal.total).toFixed(2)}</p>
    <h3>Terms & Conditions</h3><div dangerouslySetInnerHTML={{ __html: t.terms_html }} />
    <p className="pd-sign">Signature: ______________________________&nbsp;&nbsp;Name (print): ______________________________&nbsp;&nbsp;Date: ______________</p>
    <div className="pd-foot">{t.footer}</div>
  </div>);
}

function AgentCommand({ openLead, openJob }: any) {
  const [text, setText] = useState(""); const [busy, setBusy] = useState(false); const [report, setReport] = useState<any>(null); const [runs, setRuns] = useState<any[]>([]); const [err, setErr] = useState("");
  const loadRuns = () => { api("/api/agent/runs").then(setRuns).catch(() => {}); };
  useEffect(loadRuns, []);
  const run = async (t?: string) => { const cmd = (t ?? text).trim(); if (!cmd || busy) return; setBusy(true); setErr(""); try { const r = await api("/api/agent/command", { method: "POST", body: { text: cmd } }); setReport(r); setText(""); loadRuns(); } catch (e: any) { setErr(e.message); } setBusy(false); };
  const examples = ["Get my business organized", "Prepare proposals for all qualified leads missing one", "Review all active jobs — missing documents, scheduling, invoicing", "Find customers and proposals going cold and recover them", "How did we do this week?"];
  return (<div className="card" style={{ borderLeft: "4px solid #14532d", marginBottom: 14 }}>
    <h3 style={{ marginTop: 0 }}>🤖 Agent — tell it what to do</h3>
    <p className="sub" style={{ marginTop: 0 }}>It plans, uses the product's tools, respects your autonomy level and approval rules, and reports back with evidence. It never sends customer messages or changes prices on its own.</p>
    <div className="rowflex"><input style={{ flex: 1 }} placeholder="e.g. Prepare proposals for all qualified leads missing one" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") run(); }} /><button className="btn" disabled={busy} onClick={() => run()}>{busy ? "Working…" : "Run"}</button></div>
    <div className="chipRow" style={{ marginTop: 8 }}>{examples.map(x => <button key={x} className="chip" onClick={() => run(x)}>{x}</button>)}</div>
    {err && <div className="err">{err}</div>}
    {report && <div style={{ marginTop: 12 }}>{report.results.map((r: any, i: number) => <div key={i} style={{ padding: "8px 0", borderTop: "1px solid #e2e8f0" }}><b>{r.tool.replaceAll("_", " ")}</b> <span className="tinyBadge">{r.mode}</span><br /><span>{r.summary}</span>{r.items.length > 0 && <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{r.items.slice(0, 8).map((it: any, j: number) => <li key={j}>{it.lead_id ? <span className="clickable" onClick={() => openLead && openLead(it.lead_id)}>{it.label} →</span> : it.label}</li>)}</ul>}</div>)}</div>}
    {runs.length > 0 && <details style={{ marginTop: 10 }}><summary className="muted" style={{ cursor: "pointer" }}>Previous runs ({runs.length})</summary>{runs.slice(0, 6).map((r: any) => <p key={r.id} className="muted" style={{ margin: "4px 0", fontSize: 12.5 }}>“{r.command}” · {new Date(r.created_at).toLocaleString()} · {r.results?.map((x: any) => x.tool).join(", ")}</p>)}</details>}
  </div>);
}

function AIAssistant({ go, openLead, openJob }: any) {
  const [ins, setIns] = useState<any[]>([]); const [prev, setPrev] = useState<any>(null); const [acts, setActs] = useState<any>({ dedupe: true, spam: true, score: true, assign: false });
  const [result, setResult] = useState<any>(null); const [msg, setMsg] = useState("");
  const [auto, setAuto] = useState<any>(null); const [runs, setRuns] = useState<any[]>([]);
  const loadIns = () => { api("/api/ai/insights").then(setIns).catch(() => {}); api("/api/ai/runs").then(setRuns).catch(() => {}); };
  useEffect(() => { loadIns(); api("/api/ai/automations").then(setAuto).catch(() => {}); }, []);
  const scan = async () => { setPrev(await api("/api/ai/cleanup/preview", { method: "POST", body: {} })); setResult(null); };
  const apply = async () => { const chosen = Object.entries(acts).filter(([, v]) => v).map(([k]) => k); const r = await api("/api/ai/cleanup/apply", { method: "POST", body: { actions: chosen } }); setResult(r); setPrev(null); loadIns(); };
  const actFor = (i: any) => {
    if (i.kind === "cleanup") return <button className="btn ghost small" onClick={scan}>Run cleanup scan</button>;
    if (i.kind === "assign") return <button className="btn ghost small" onClick={async () => { const r = await api("/api/ai/cleanup/apply", { method: "POST", body: { actions: ["assign"] } }); setMsg(`Auto-assigned ${r.assigned} leads round-robin ✓`); loadIns(); }}>Auto-assign now</button>;
    if (i.kind === "stale") return <button className="btn ghost small" onClick={async () => { const r = await api("/api/ai/reactivate", { method: "POST", body: {} }); setMsg(`Reactivation tasks created: ${r.tasks_created} ✓`); }}>Create tasks</button>;
    if (i.kind === "hot") return <button className="btn ghost small" onClick={() => go({ view: "leads", leads: { sort: "value" } })}>View leads</button>;
    if (i.kind === "nextstep") return <button className="btn ghost small" onClick={async () => { const r = await api("/api/ai/autofix-next-steps", { method: "POST", body: {} }); setMsg(`Next steps auto-scheduled on ${r.fixed} leads ✓`); loadIns(); }}>Auto-schedule next steps</button>;
    if (i.kind === "approvals") return <button className="btn ghost small" onClick={() => go({ view: "approvals" })}>Review approvals</button>;
    if (i.kind === "cold") return <button className="btn ghost small" onClick={async () => { const r = await api("/api/ai/nudge", { method: "POST", body: { lead_id: i.lead_id } }); setMsg(`Nudge sent by ${r.channel} (${String(r.status).replaceAll("_", " ")}) ✓`); }}>Nudge the oldest now</button>;
    return null;
  };
  const setAutoKey = async (k: string, v: boolean) => { const r = await api("/api/ai/automations", { method: "POST", body: { [k]: v } }); setAuto(r); };
  const agentLabel: Record<string, string> = { triage: "🔍 Triage", automation: "🤖 Auto-pilot", nudge: "📨 Nudge", packet_check: "🛂 Packet check" };
  return (<div>
    <AgentCommand openLead={openLead} openJob={openJob} /><h2 className="pt">AI Assistant</h2><p className="sub">Agents do the chasing, sorting, and scoring — nothing customer-facing ever sends without your approval. Every action here is preview first, apply second; auto-pilot actions are logged below.</p>
    {msg && <div className="ok">{msg}</div>}
    <div className="card"><h3>Insights — what needs you today</h3>
      {ins.map((i: any, k: number) => <div className="insight" key={k}><div className="ic">{i.icon}</div><div style={{ flex: 1 }}><b>{i.title}</b><p>{i.detail}</p></div>{actFor(i)}</div>)}
      {ins.length === 0 && <p className="muted">All clear — no duplicates, no unassigned leads, nothing stale, nothing going cold. The AI is watching.</p>}</div>
    <div className="card"><h3>Auto-pilot — runs every few hours, even while you sleep</h3>
      {!auto && <p className="muted">Loading…</p>}
      {auto && <div>
        {[["auto_score", "Keep every lead scored", "Hot / warm / cold stays current as leads age and change."], ["auto_assign", "Auto-assign unassigned leads", "Round-robin to lead owners the moment a lead sits unowned."], ["auto_dedupe", "Auto-archive duplicates", "Exact phone/email matches and same-week name+service repeats — original kept, merge recorded."], ["auto_reactivate", "Auto-create reactivation tasks", "Any open lead untouched for 14+ days gets a call task for its owner."]].map(([k, lab, hint]) => <label className="check" key={k} style={{ display: "flex", gap: 8, padding: "7px 0", borderBottom: "1px solid #eef2f7" }}><input type="checkbox" style={{ width: "auto", marginTop: 2 }} checked={!!auto[k]} onChange={e => setAutoKey(k, e.target.checked)} /><span><b>{lab}</b><br /><span className="muted">{hint}</span></span></label>)}
        <div className="rowflex" style={{ marginTop: 10 }}><button className="btn ghost small" onClick={async () => { const r = await api("/api/ai/automations/run", { method: "POST", body: {} }); setMsg("Auto-pilot ran ✓ — " + JSON.stringify(r.result)); loadIns(); api("/api/ai/automations").then(setAuto).catch(() => {}); }}>Run auto-pilot now</button><span className="muted">{auto.last_automation_at ? "Last ran " + dt(auto.last_automation_at) : "Has not run yet"}</span></div>
      </div>}
    </div>
    <AutonomyCard />
    <ProviderCard />
    <PlaybookCard />
    <AgentMetricsCard />
    <QuietHoursCard />
    <SuppressionsCard />
    <div className="card"><h3>AI Cleanup — duplicates, spam, scoring, assignment</h3>
      {!prev && !result && <button className="btn" onClick={scan}>Run cleanup scan</button>}
      {prev && <div><p><b>{prev.duplicate_count}</b> duplicates · <b>{prev.spam_count}</b> spam/invalid · <b>{prev.unassigned_count}</b> unassigned · <b>{prev.unscored_count}</b> unscored — of {num(prev.total_leads)} leads</p>
        {prev.duplicates.slice(0, 6).map((d: any) => <p className="muted" key={d.id} style={{ margin: "3px 0" }}>Duplicate: {d.name} — {d.service} (original kept)</p>)}
        {prev.spam.slice(0, 4).map((d: any) => <p className="muted" key={d.id} style={{ margin: "3px 0" }}>Spam/invalid: {d.name || "—"} — {d.service}</p>)}
        <div style={{ margin: "12px 0" }}>{[["dedupe", "Archive duplicates (original kept, merge recorded)"], ["spam", "Mark spam/invalid as Junk"], ["score", "Score every lead (hot / warm / cold)"], ["assign", "Auto-assign unassigned leads round-robin"]].map(([k, lab]) => <label className="check" key={k}><input type="checkbox" style={{ width: "auto" }} checked={acts[k]} onChange={e => setActs({ ...acts, [k]: e.target.checked })} /><span>{lab}</span></label>)}</div>
        <div className="rowflex"><button className="btn" onClick={apply}>Apply cleanup</button><button className="btn ghost" onClick={() => setPrev(null)}>Cancel</button></div></div>}
      {result && <div className="ok">Cleanup applied ✓ — {result.archived_duplicates} duplicates archived · {result.marked_spam} spam marked · {result.scored} leads scored · {result.assigned} auto-assigned. <button className="btn ghost small" onClick={scan}>Scan again</button></div>}
    </div>
    <div className="card"><h3>Recent agent activity</h3>
      {runs.map((r: any) => <p key={r.id} style={{ margin: "6px 0", borderBottom: "1px solid #eef2f7", paddingBottom: 6 }}><b>{agentLabel[r.agent] || r.agent}</b> <span className="muted">· {dt(r.created_at)}</span><br /><span className="muted">{String(r.output || "").slice(0, 220)}</span></p>)}
      {runs.length === 0 && <p className="muted">No agent runs logged yet — triage, nudges, and auto-pilot runs will appear here.</p>}</div>
    <div className="card"><h3>How the agents work</h3><p className="muted" style={{ lineHeight: 1.6 }}>Triage classifies every incoming lead (service, urgency, value band, spam) the second it lands. Scoring ranks the pile so humans call hot leads first, and every lead record carries a plain-English next-best-action from the same engine. Cleanup keeps the data honest. Auto-pilot repeats the safe chores on a timer. The Completeness Gate is the bouncer: no packet reaches an approver missing contact, scope, visit, PM, or price-book pricing. Agents never invent prices and never send anything customer-facing on their own — that line is enforced in code, not policy.</p></div>
  </div>);
}

function SyncModal({ close, done }: any) {
  const [preset, setPreset] = useState("30"); const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [cfg, setCfg] = useState<any>(null); const [res, setRes] = useState<any>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  useEffect(() => { api("/api/settings").then(r => setCfg(r.workspace)).catch(() => {}); }, []);
  const range = () => { const days = Number(preset); if (preset === "custom") return { from: new Date(from).toISOString(), to: new Date(to).toISOString() }; const end = new Date(); const start = new Date(Date.now() - (days - 1) * 86400000); start.setHours(0, 0, 0, 0); return { from: start.toISOString(), to: end.toISOString() }; };
  const run = async () => { setBusy(true); setErr(""); try { const r = await api("/api/sync/run", { method: "POST", body: range() }); setRes(r); } catch (e: any) { setErr(e.message); } setBusy(false); };
  return (<div className="modalWrap"><div className="modal" style={{ maxWidth: 560 }}><h3 style={{ marginTop: 0 }}>Sync leads from your source system</h3>
    <p className="muted">Pulls leads created in the selected window and imports them — duplicates are detected by phone/email and skipped, never double-created. Source: <b>{cfg?.source_api_url ? cfg.source_api_url : "Demo source (built-in sample system)"}</b>{cfg?.last_sync_at ? <> · last sync {dt(cfg.last_sync_at)}</> : ""}</p>
    {err && <div className="err">{err}</div>}
    <label className="f">How far back?</label>
    <div className="chipRow">{[["1", "Today"], ["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"], ["custom", "Custom range"]].map(([k, lab]) => <button key={k} className={`chip ${preset === k ? "on" : ""}`} onClick={() => setPreset(k)}>{lab}</button>)}</div>
    {preset === "custom" && <div className="formgrid"><div><label className="f">From</label><input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div><div><label className="f">To</label><input type="date" value={to} onChange={e => setTo(e.target.value)} /></div></div>}
    <label className="check" style={{ marginTop: 12 }}><input type="checkbox" style={{ width: "auto" }} checked={!!cfg?.sync_enabled} onChange={async e => { await api("/api/settings", { method: "PATCH", body: { sync_enabled: e.target.checked } }); setCfg({ ...cfg, sync_enabled: e.target.checked ? 1 : 0 }); }} /><span><b>Daily auto-sync</b> — pull yesterday's leads every morning automatically</span></label>
    {res && <div className="ok">Sync complete ✓ — fetched {res.fetched} · created {res.created} · duplicates skipped {res.duplicates} · errors {res.errors}</div>}
    <div className="rowflex" style={{ marginTop: 14 }}><button className="btn" disabled={busy} onClick={run}>{busy ? "Syncing…" : "⇅ Run sync"}</button><button className="btn ghost" onClick={() => { close(); if (res) done(); }}>Close</button></div>
    <p className="muted" style={{ fontSize: 12.5 }}>Prefer a file? Use Import CSV — same dedupe, same ownership rules. Point the source at your real system in Settings → Workspace (Source API URL).</p>
  </div></div>);
}


const relTime = (s: any) => { if (!s) return ""; const m = Math.max(1, Math.round((Date.now() - new Date(s).getTime()) / 60000)); if (m < 60) return m + "m ago"; const h = Math.round(m / 60); if (h < 24) return h + "h ago"; return Math.round(h / 24) + "d ago"; };
const EV_ICON: Record<string, string> = { created: "🆕", state_changed: "➡️", proposal_created: "📄", proposal_sent: "📨", message_email: "✉️", message_sms: "💬", task: "✅", note: "📝", approval_requested: "🙋", approval_decided: "⚖️", signed: "✍️" };
function MyDay({ user, openLead, go }: any) {
  const [d, setD] = useState<any>(null); const [tickL, setTickL] = useState(0);
  useEffect(() => { api("/api/myday").then(setD).catch(() => {}); }, [tickL]);
  const hour = new Date().getHours(); const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = (user?.name || "").split(" ")[0];
  if (!d) return <p className="muted">Loading your day…</p>;
  const done = async (tid: string) => { await api(`/api/tasks/${tid}/complete`, { method: "POST", body: {} }); setTickL(t => t + 1); };
  const TaskRow = ({ t, late }: any) => <div className="pulseRow" style={{ cursor: "default" }}><span className="pulseIco">{late ? "⏰" : "✅"}</span><div style={{ flex: 1 }} onClick={() => openLead(t.lead_id)}><b>{t.title}</b> <span className="muted">· {t.contact_name || ""} — {t.service_requested || ""}</span><br /><span className={late ? "" : "muted"} style={late ? { color: "#b91c1c", fontWeight: 600 } : {}}>{late ? "Overdue — " : "Due "}{dOnly(t.due_at)}</span></div><button className="btn ghost small" onClick={() => done(t.id)}>✓ Done</button></div>;
  const nothing = d.overdue_tasks.length + d.today_tasks.length + d.my_leads_due.length + d.approvals_waiting.length === 0;
  return (<div><h2 className="pt">{greet}, {first}.</h2><p className="sub">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} — your personal queue. The business dashboard is one click over; this page is just yours.</p>
    {d.timesheet_alert && <div className="card" style={{ marginBottom: 14, borderLeft: "4px solid #b45309" }}><b>⏱ Your timesheet for the week of {d.timesheet_alert.week_of} is missing.</b> <span className="muted">Log the total here, or open Ops Console → Timesheets for the per-day grid.</span>
      <span className="rowflex" style={{ marginLeft: 10 }}><input type="number" min="0" placeholder="Total hours" style={{ width: 110 }} id="tsquick" /><button className="btn small" onClick={async () => { const v = (document.getElementById("tsquick") as HTMLInputElement).value; await api("/api/timesheets", { method: "POST", body: { week_of: d.timesheet_alert.week_of, hours: Number(v) || 0 } }); setTickL(t => t + 1); }}>Log it</button></span></div>}
    {d.field_alert && <div className="card" style={{ marginBottom: 14, borderLeft: "4px solid #b45309" }}><b>📋 Your field report for {d.field_alert.report_date} is missing.</b> <span className="muted">File the short version here, or open Ops Console → Field reports to attach it to a job.</span>
      <span className="rowflex" style={{ marginLeft: 10 }}><input placeholder="What got done yesterday…" style={{ width: 260 }} id="frquick" /><button className="btn small" onClick={async () => { const v = (document.getElementById("frquick") as HTMLInputElement).value; await api(`/api/field-reports/${d.field_alert.id}/submit`, { method: "POST", body: { notes: v } }); setTickL(t => t + 1); }}>File report</button></span></div>}
    <div className="kpis" style={{ marginBottom: 14 }}>
      <div className="kpi"><div className="lab">⏰ Overdue tasks</div><div className="val" style={{ color: d.overdue_tasks.length ? "#b91c1c" : undefined }}>{num(d.overdue_tasks.length)}</div><div className="hint">Assigned to you, past due</div></div>
      <div className="kpi" onClick={() => (window as any).wpLogTime?.()} style={{ cursor: "pointer" }}><div className="lab">⏱ Log time</div><div className="val">10-sec</div><div className="hint">Any worker, any job — a name is enough</div></div>
      <div className="kpi" onClick={() => go({ view: "ops" })} style={{ cursor: "pointer" }}><div className="lab">📥 Inbox waiting</div><div className="val" style={{ color: d.inbox_count ? "#b45309" : undefined }}>{num(d.inbox_count || 0)}</div><div className="hint">Client mail & more — not leads</div></div>
      <div className="kpi"><div className="lab">📋 Due today</div><div className="val">{num(d.today_tasks.length + d.my_leads_due.length)}</div><div className="hint">Tasks + lead next steps</div></div>
      <div className="kpi" onClick={() => go({ view: "approvals" })}><div className="lab">⚖️ Approvals waiting</div><div className="val">{num(d.approvals_count)}</div><div className="hint">Packets needing a decision</div></div>
      <div className="kpi"><div className="lab">🏆 Wins this week</div><div className="val">{num(d.wins_week.count)} · {money(d.wins_week.value)}</div><div className="hint">Closed across the business</div></div>
    </div>
    {nothing && <div className="card" style={{ textAlign: "center", padding: 30 }}><div style={{ fontSize: 32 }}>🌤️</div><b>Your queue is clear.</b><p className="muted">No overdue tasks, nothing due today, no approvals waiting on you. Check Pulse for what the team is moving.</p></div>}
    {(d.overdue_tasks.length > 0 || d.today_tasks.length > 0) && <div className="card" style={{ padding: "6px 14px", marginBottom: 12 }}><h3 style={{ margin: "10px 0 4px" }}>Your tasks</h3>{d.overdue_tasks.map((t: any) => <TaskRow key={t.id} t={t} late />)}{d.today_tasks.map((t: any) => <TaskRow key={t.id} t={t} />)}</div>}
    {d.my_leads_due.length > 0 && <div className="card" style={{ padding: "6px 14px", marginBottom: 12 }}><h3 style={{ margin: "10px 0 4px" }}>Your leads need a next step</h3>{d.my_leads_due.map((l: any) => <div key={l.id} className="pulseRow" onClick={() => openLead(l.id)}><span className="pulseIco">🎯</span><div style={{ flex: 1 }}><b>{l.contact_name}</b> <span className="muted">· {l.service_requested}</span><br /><span>{l.next_action || "Follow up"} — due {dOnly(l.next_action_due_at)}</span></div><Badge s={l.state} /></div>)}</div>}
    {d.approvals_waiting.length > 0 && <div className="card" style={{ padding: "6px 14px", marginBottom: 12 }}><h3 style={{ margin: "10px 0 4px" }}>Waiting on your approval</h3>{d.approvals_waiting.map((a: any) => <div key={a.id} className="pulseRow" onClick={() => go({ view: "approvals" })}><span className="pulseIco">⚖️</span><div style={{ flex: 1 }}><b>{a.contact_name}</b> <span className="muted">· {a.service_requested}</span><br /><span>{money(a.est_value)} · {a.tier} tier · submitted {dt(a.submitted_at)}</span></div><span className="muted">Decide →</span></div>)}</div>}
    {d.followups_due.length > 0 && <div className="card" style={{ padding: "6px 14px" }}><h3 style={{ margin: "10px 0 4px" }}>🔁 Follow-ups firing by tomorrow</h3>{d.followups_due.map((f: any) => <div key={f.id} className="pulseRow" onClick={() => openLead(f.lead_id)}><span className="pulseIco">📨</span><div style={{ flex: 1 }}><b>{f.contact_name}</b> <span className="muted">· {f.service_requested}</span><br /><span>Step {(f.step_idx || 0) + 1} nudge — {dt(f.next_due_at)}</span></div></div>)}</div>}
  </div>);
}

function Pulse({ openLead }: any) {
  const [evs, setEvs] = useState<any[]>([]);
  useEffect(() => { api("/api/activity").then(r => setEvs(r.events)).catch(() => {}); }, []);
  return (<div><h2 className="pt">Pulse</h2><p className="sub">Everything happening in the business, as it happens — every lead, proposal, signature and decision in one stream.</p>
    <div className="card" style={{ padding: "6px 14px" }}>{evs.length === 0 && <p className="muted">No activity yet.</p>}
      {evs.map((e: any) => <div key={e.id} className="pulseRow" onClick={() => openLead(e.lead_id)}><span className="pulseIco">{EV_ICON[e.event_type] || "•"}</span><div style={{ flex: 1 }}><b>{e.contact_name || "Lead"}</b> <span className="muted">· {e.service_requested || ""}</span><br /><span>{e.event_type.replaceAll("_", " ")}{e.from_state ? ` ${e.from_state.replaceAll("_", " ")} → ${e.to_state.replaceAll("_", " ")}` : ""}</span> <span className="muted">— {e.actor_name || "system"}</span></div><span className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{relTime(e.created_at)}</span></div>)}
    </div></div>);
}

function CommandPalette({ close, go, openLead, newLead }: any) {
  const [q, setQ] = useState(""); const [leads, setLeads] = useState<any[]>([]); const [recents, setRecents] = useState<any[]>([]); const [idx, setIdx] = useState(0);
  const ACTIONS = [
    { label: "Work Queue", hint: "G then Q", run: () => go({ view: "queue" }) },
    { label: "Jobs", hint: "G then J", run: () => go({ view: "jobs" }) },
    { label: "Log time", hint: "T", run: () => (window as any).wpLogTime?.() },
    { label: "Customers", hint: "", run: () => go({ view: "customers" }) },
    { label: "People", hint: "", run: () => (window as any).wpGoTab?.("customers", "people") },
    { label: "Campaigns", hint: "", run: () => go({ view: "campaigns" }) },
    { label: "Tasks", hint: "", run: () => (window as any).wpGoTab?.("planner", "tasks") },
    { label: "Calendar", hint: "", run: () => (window as any).wpGoTab?.("planner", "calendar") },
    { label: "Notes", hint: "", run: () => (window as any).wpGoTab?.("library", "notes") },
    { label: "Files & Documents", hint: "", run: () => (window as any).wpGoTab?.("library", "files") },
    { label: "Duplicates", hint: "", run: () => go({ view: "leads", leads: { mode: "dupes" } }) },
    { label: "My Day", hint: "G then M", run: () => go({ view: "myday" }) },
    { label: "Dashboard", hint: "G then D", run: () => go({ view: "dashboard" }) },
    { label: "Pulse — activity stream", hint: "G then P", run: () => go({ view: "pulse" }) },
    { label: "Leads", hint: "G then L", run: () => go({ view: "leads" }) },
    { label: "Approvals", hint: "G then A", run: () => go({ view: "approvals" }) },
    { label: "Reports", hint: "G then R", run: () => go({ view: "reports" }) },
    { label: "AI Assistant", hint: "", run: () => go({ view: "ai" }) },
    { label: "Import CSV", hint: "", run: () => go({ view: "imports" }) },
    { label: "Demand Gap", hint: "", run: () => go({ view: "demand" }) },
    { label: "Handoffs", hint: "", run: () => go({ view: "handoffs" }) },
    { label: "Ops Console", hint: "", run: () => go({ view: "ops" }) },
    { label: "Settings", hint: "G then S", run: () => go({ view: "settings" }) },
    { label: "Billing", hint: "", run: () => go({ view: "billing" }) },
    { label: "＋ New lead", hint: "N", run: () => newLead() },
  ];
  useEffect(() => { const ids: string[] = JSON.parse(localStorage.getItem("wp_recent") || "[]"); Promise.all(ids.slice(0, 5).map(id => api(`/api/leads/${id}`).then(r => r.lead || r).catch(() => null))).then(rs => setRecents(rs.filter(Boolean))); }, []);
  const [gs, setGs] = useState<any>(null);
  useEffect(() => { if (!q.trim()) { setLeads([]); return; } const t = setTimeout(() => { api(`/api/leads?paged=1&page=1&page_size=6&q=${encodeURIComponent(q)}`).then(r => setLeads(r.items || [])).catch(() => {}); api(`/api/search?q=${encodeURIComponent(q)}`).then(setGs).catch(() => {}); }, 160); return () => clearTimeout(t); }, [q]);
  const acts = ACTIONS.filter(a => a.label.toLowerCase().includes(q.toLowerCase()));
  const items: any[] = [...(q ? [] : recents.map((l: any) => ({ label: `${l.contact_name || "Lead"} — ${l.service_requested || ""}`, sub: "Recent", run: () => openLead(l.id) }))), ...acts.map(a => ({ ...a, sub: "Go / do" })), ...leads.map((l: any) => ({ label: `${l.contact_name || "Lead"} — ${l.service_requested || ""}`, sub: "Lead · " + l.state, run: () => openLead(l.id) })),
    ...((gs?.jobs || []).map((j: any) => ({ label: `${j.contact_name || "Job"} — ${j.title}`, sub: "Job · " + j.sub, run: () => (window as any).wpOpenJob?.(j.id) }))),
    ...((gs?.accounts || []).map((a: any) => ({ label: a.title, sub: "Customer", run: () => (window as any).wpOpenAccount?.(a.id) }))),
    ...((gs?.people || []).map((p: any) => ({ label: p.title, sub: "Person", run: () => (window as any).wpGoTab?.("customers", "people") }))),
    ...((gs?.campaigns || []).map((c: any) => ({ label: c.title, sub: "Campaign", run: () => go({ view: "campaigns" }) }))),
    ...((gs?.invoices || []).map((iv: any) => ({ label: `${iv.title} — $${Math.round(iv.total || 0).toLocaleString()}`, sub: "Invoice · " + iv.sub, run: () => iv.job_id ? (window as any).wpOpenJob?.(iv.job_id) : openLead(iv.lead_id) }))),
    ...((gs?.proposals || []).map((p: any) => ({ label: p.title, sub: "Proposal · " + p.sub, run: () => openLead(p.lead_id) })))];
  useEffect(() => { setIdx(0); }, [q]);
  const pick = (it: any) => { if (it) { close(); it.run(); } };
  return (<div className="modalWrap" onClick={close}><div className="palette" onClick={e => e.stopPropagation()}>
    <input autoFocus placeholder="Search leads, jump to a view, run an action…" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === "ArrowDown") { e.preventDefault(); setIdx(i => Math.min(items.length - 1, i + 1)); } if (e.key === "ArrowUp") { e.preventDefault(); setIdx(i => Math.max(0, i - 1)); } if (e.key === "Enter") pick(items[idx]); if (e.key === "Escape") close(); }} />
    <div className="palList">{items.length === 0 && <p className="muted" style={{ padding: "10px 12px" }}>No matches.</p>}
      {items.map((it, i) => <div key={i} className={`palItem ${i === idx ? "on" : ""}`} onMouseEnter={() => setIdx(i)} onClick={() => pick(it)}><span style={{ flex: 1 }}>{it.label}</span><span className="muted" style={{ fontSize: 12 }}>{it.sub}{it.hint ? ` · ${it.hint}` : ""}</span></div>)}
    </div>
    <div className="palFoot">↑↓ navigate · Enter open · Esc close</div>
  </div></div>);
}

const DEF_STEPS = [
  { day: 2, channel: "email", template: "Hi {name}, just floating your proposal from {business} back to the top of your inbox — total {total}. Review & sign here: {link}" },
  { day: 5, channel: "sms", template: "{business}: your proposal ({total}) is waiting — review & sign: {link}" },
  { day: 10, channel: "email", template: "Hi {name}, last nudge from {business} — your proposal ({total}) is still open here: {link}" },
];
function BookingSettings({ ws }: any) {
  const [on, setOn] = useState(!!ws.booking_enabled); const [note, setNote] = useState("");
  const url = `${location.origin}/book/${ws.booking_slug || ""}`;
  return (<div className="card" style={{ marginTop: 14 }}><h3 style={{ marginTop: 0 }}>📅 Online booking page</h3>
    <label className="check" style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={on} onChange={async e => { setOn(e.target.checked); await api("/api/settings", { method: "PATCH", body: { booking_enabled: e.target.checked } }); setNote(e.target.checked ? "Live ✓" : "Off"); }} style={{ width: "auto" }} /> Let customers book site visits from a public page</label>
    <p className="muted">Your page: <a href={url} target="_blank" rel="noreferrer">{url}</a> — every booking lands as an owned lead with the visit already scheduled, and owners get notified. Put it on your website, Google profile, and email signature.{note && <> · {note}</>}</p></div>);
}

function FollowupSettings({ ws }: any) {
  const initSteps = (() => { try { const p = JSON.parse(ws.followup_steps || "null"); if (Array.isArray(p) && p.length) return p; } catch {} return DEF_STEPS; })();
  const [on, setOn] = useState(!!ws.followup_enabled); const [steps, setSteps] = useState<any[]>(initSteps);
  const [revOn, setRevOn] = useState(!!ws.review_on_won); const [revUrl, setRevUrl] = useState(ws.review_url || ""); const [note, setNote] = useState("");
  const save = async () => { await api("/api/settings", { method: "PATCH", body: { followup_enabled: on, followup_steps: steps, review_on_won: revOn, review_url: revUrl } }); setNote("Saved ✓"); };
  return (<div className="card" style={{ marginTop: 14 }}><h3 style={{ marginTop: 0 }}>🔁 Follow-up cadence <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>— automatic nudges while a proposal waits (the follow-up machine every field-service CRM runs)</span></h3>
    <label className="check" style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={on} onChange={e => setOn(e.target.checked)} style={{ width: "auto" }} /> Turn on automatic follow-ups for sent proposals</label>
    {steps.map((st, i) => <div className="rowflex" key={i} style={{ marginTop: 8 }}><span className="muted">Day</span><input type="number" style={{ width: 70 }} value={st.day} onChange={e => { const c = [...steps]; c[i] = { ...c[i], day: Number(e.target.value) }; setSteps(c); }} /><select style={{ width: 110 }} value={st.channel} onChange={e => { const c = [...steps]; c[i] = { ...c[i], channel: e.target.value }; setSteps(c); }}><option value="email">Email</option><option value="sms">SMS</option></select><input style={{ flex: 1 }} value={st.template} onChange={e => { const c = [...steps]; c[i] = { ...c[i], template: e.target.value }; setSteps(c); }} /></div>)}
    <p className="muted">Merge fields: {"{name} {business} {total} {link}"}. Stops automatically on signature, final outcome, or a manual stop on the lead. SMS steps need the lead's texting consent (TCPA).</p>
    <h3>⭐ Reviews & referrals</h3>
    <label className="check" style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={revOn} onChange={e => setRevOn(e.target.checked)} style={{ width: "auto" }} /> When a lead is Won, email the customer a review request</label>
    <div style={{ marginTop: 8 }}><label className="f">Google review link</label><input value={revUrl} placeholder="https://g.page/r/…" onChange={e => setRevUrl(e.target.value)} /></div>
    <div className="rowflex" style={{ marginTop: 12 }}><button className="btn" onClick={save}>Save follow-ups & reviews</button>{note && <span className="muted">{note}</span>}</div>
  </div>);
}

// ---------- v3 components (slices 29-36) ----------
function CallbackForm({ leadId, done }: any) {
  const [when, setWhen] = useState(""); const [note, setNote] = useState(""); const [msg, setMsg] = useState("");
  return (<div><div className="rowflex"><input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} /><input placeholder="Note — e.g. 'call me Thursday, gate code 4417'" value={note} onChange={e => setNote(e.target.value)} style={{ flex: 1 }} />
    <button className="btn small" disabled={!when} onClick={async () => { await api(`/api/leads/${leadId}/callback`, { method: "POST", body: { due_at: new Date(when).toISOString(), note } }); setMsg("Callback set ✓ — it resurfaces in the Work Queue at that time"); setNote(""); done && done(); }}>Set callback</button></div>
    {msg && <p className="muted" style={{ marginTop: 6 }}>{msg}</p>}<p className="muted" style={{ fontSize: 12.5 }}>"Call me Thursday" is a promise — it lands in the queue when it's due, with your note attached.</p></div>);
}

function WorkQueue({ openLead, openJob, go }: any) {
  const [q, setQ] = useState<any>(null); const [typeF, setTypeF] = useState("all"); const [focus, setFocus] = useState(0);
  const [sel, setSel] = useState<Set<string>>(new Set()); const [team, setTeam] = useState<any[]>([]); const [bulkMsg, setBulkMsg] = useState("");
  useEffect(() => { api("/api/users").then(setTeam).catch(() => {}); }, []);
  const [keysOn, setKeysOn] = useState(() => { try { return localStorage.getItem("wp_keys") !== "off"; } catch { return true; } });
  const toggleSel = (id: string) => setSel(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selItems = (q?.items || []).filter((i: any) => sel.has(i.id) && i.lead_id);
  const bulk = async (action: string, extra: any = {}) => { if (!selItems.length) return; const r = await api("/api/queue/bulk", { method: "POST", body: { lead_ids: selItems.map((i: any) => i.lead_id), action, ...extra } }).catch((e: any) => ({ error: e.message })); if ((r as any).error) { setBulkMsg((r as any).error); return; } setBulkMsg(`${action === "assign" ? "Assigned" : action === "snooze" ? "Snoozed" : "Tasks created for"} ${r.affected} lead${r.affected === 1 ? "" : "s"} ✓`); toast(`Bulk ${action}: ${r.affected} leads ✓`); setSel(new Set()); load(); };
  const load = () => { api("/api/queue").then(setQ).catch(() => {}); };
  useEffect(load, []);
  useLive(load);
  const items = (q?.items || []).filter((i: any) => typeF === "all" || i.type === typeF);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (!keysOn) return; const t = e.target as HTMLElement; if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
    if (e.key.toLowerCase() === "j") setFocus(f => Math.min(items.length - 1, f + 1));
    if (e.key.toLowerCase() === "k") setFocus(f => Math.max(0, f - 1));
    if (e.key === "Enter" && items[focus]) act(items[focus]); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [items, focus, keysOn]);
  const act = (i: any) => { if (i.type === "approval") go({ view: "approvals" }); else if (i.job_id && i.type !== "followup_overdue" && i.type !== "lead_untouched" && i.type !== "proposal_cold" && i.type !== "proposal_viewed") openJob(i.job_id); else if (i.type === "inbox") go({ view: "ops" }); else if (i.type === "field_report" || i.type === "timesheet") go({ view: "ops" }); else if (i.lead_id) openLead(i.lead_id); };
  const doneQuick = async (i: any) => { if (i.type === "callback") await api(`/api/callbacks/${i.callback_id}/done`, { method: "POST", body: {} }); load(); };
  if (!q) return <p className="muted">Loading your pile…</p>;
  const LBL: Record<string, string> = { handoff_failed: "⚠ Handoff failed", approval: "✋ Approval", callback: "📞 Callback", followup_overdue: "⏰ Overdue", lead_untouched: "🆕 Untouched", proposal_viewed: "👁 Viewed, unsigned", inbox: "✉ Inbox", proposal_cold: "🧊 Going cold", job_crew: "👷 Needs crew", paperwork: "📄 Paperwork", field_report: "📋 Field report", timesheet: "⏱ Timesheet" };
  return (<div><h2 className="pt">Work Queue</h2><p className="sub">Everything that needs a human, worst-first — leads, email, approvals, jobs, paperwork. Work it to zero. <span className="muted">Keys: J/K move · Enter open</span></p>
    {selItems.length > 0 && <div className="card" style={{ padding: "10px 14px", marginBottom: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", background: "#f0fdf4" }}><b>{selItems.length} selected</b><select id="bulkAssign" style={{ width: 180 }} defaultValue=""><option value="">Assign to…</option>{team.filter((u: any) => u.permissions?.leads_scope !== "none").map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}</select><button className="btn small" onClick={() => { const v = (document.getElementById("bulkAssign") as HTMLSelectElement).value; if (v) bulk("assign", { assignee_id: v }); else setBulkMsg("Pick a person to assign to first."); }}>Assign</button><button className="btn ghost small" onClick={() => bulk("snooze", { days: 1 })}>Snooze 1d</button><button className="btn ghost small" onClick={() => bulk("snooze", { days: 3 })}>Snooze 3d</button><button className="btn ghost small" onClick={() => bulk("task", { title: "Follow up (bulk from queue)" })}>+ Follow-up task</button><button className="btn ghost small" onClick={() => setSel(new Set())}>Clear</button>{bulkMsg && <span className="muted">{bulkMsg}</span>}</div>}
    <div className="rowflex" style={{ marginBottom: 10 }}><button className={`chip ${typeF === "all" ? "on" : ""}`} onClick={() => setTypeF("all")}>All ({q.total})</button>{Object.entries(q.by_type || {}).map(([t, c]: any) => <button key={t} className={`chip ${typeF === t ? "on" : ""}`} onClick={() => setTypeF(t)}>{LBL[t] || t} ({c})</button>)}<button className="btn ghost small" onClick={load}>↻ Refresh</button><button className="chip" title="Single-key shortcuts in the queue (WCAG 2.1.4 — turn them off any time)" onClick={() => { const v = !keysOn; setKeysOn(v); try { localStorage.setItem("wp_keys", v ? "on" : "off"); } catch { /* private mode */ } }}>⌨ J/K shortcuts: {keysOn ? "on" : "off"}</button></div>
    {items.length === 0 && <div className="card" style={{ textAlign: "center", padding: 34 }}><div style={{ fontSize: 34 }}>🎉</div><h3 style={{ margin: "8px 0 4px" }}>Zero. The pile is clear.</h3><p className="muted">Nothing is waiting on anyone. New leads, mail, and due follow-ups land here the moment they exist.</p></div>}
    {items.map((i: any, ix: number) => <div key={i.id} className="card qRow" style={{ ...(ix === focus ? { outline: "2px solid #166534" } : {}) }}>
      <span className="qCheck">{i.lead_id && i.type !== "approval" ? <input type="checkbox" checked={sel.has(i.id)} onChange={() => toggleSel(i.id)} onClick={e => e.stopPropagation()} style={{ width: 17, height: 17 }} /> : null}</span>
      <span className="tinyBadge qBadge">{LBL[i.type] || i.type}</span>
      <div className="qTitle"><b>{i.title}</b><span className="muted">{i.subtitle}</span></div>
      <span className="qQuick">{i.type === "callback" ? <button className="btn ghost small qDoneBtn" onClick={() => doneQuick(i)}>✓ Done</button> : null}</span>
      <button className="btn small qBtn" onClick={() => act(i)}>{i.primary?.label || "Open"}</button></div>)}
  </div>);
}

function JobsBoard({ openJob, signal, onChange }: any) {
  const [jobs, setJobs] = useState<any[]>([]); const [dragId, setDragId] = useState(""); const [hideEmpty, setHideEmpty] = useState(() => { try { return localStorage.getItem("wp_board_hide_empty") === "1"; } catch { return false; } });
  const load = () => { api("/api/jobs").then(setJobs).catch(() => {}); };
  useEffect(load, []);
  useEffect(load, [signal]);
  useLive(load);
  const drop = async (st: string) => { if (!dragId) return; const j = jobs.find(x => x.id === dragId); await api(`/api/jobs/${dragId}/stage`, { method: "POST", body: { to: st } }).catch(() => {}); setDragId(""); load(); onChange && onChange(); if (st === "SCHEDULED" && j && !j.scheduled_start) openJob(j.id); };
  const BP = JOB_STAGES.filter(s2 => s2 !== "ON_HOLD" && s2 !== "CANCELLED"); const bnext = (j: any) => { const eff = j.stage === "ON_HOLD" ? "IN_PROGRESS" : j.stage; const ci = BP.indexOf(eff); return j.stage === "ON_HOLD" ? "IN_PROGRESS" : (ci >= 0 && ci < BP.length - 1 ? BP[ci + 1] : null); };
  const advance = async (j: any) => { const nx = bnext(j); if (!nx) return; await api(`/api/jobs/${j.id}/stage`, { method: "POST", body: { to: nx } }).catch(() => {}); load(); onChange && onChange(); if (nx === "SCHEDULED" && !j.scheduled_start) openJob(j.id); };
  const cols = JOB_STAGES.filter(st => !hideEmpty || dragId || jobs.some(j => j.stage === st));
  return (<div><h2 className="pt">Jobs</h2><p className="sub">Won work, run as operations: schedule it, crew it, work it, paper it, invoice it. Drag cards to move — both directions, always.</p>
    <label className="muted" style={{ fontSize: 12.5, display: "inline-flex", gap: 6, alignItems: "center", marginBottom: 8 }}><input type="checkbox" style={{ width: "auto" }} checked={hideEmpty} onChange={e => { setHideEmpty(e.target.checked); try { localStorage.setItem("wp_board_hide_empty", e.target.checked ? "1" : "0"); } catch {} }} /> Hide empty columns</label>
    <div className="kanban">{cols.map(st => <div className="kcol" key={st} onDragOver={e => e.preventDefault()} onDrop={() => drop(st)}><h4>{st.replaceAll("_", " ")}<span>{num(jobs.filter(j => j.stage === st).length)}</span></h4>
      {jobs.filter(j => j.stage === st).map((j: any) => { const nx = bnext(j); return <div className="kcard" key={j.id} draggable onDragStart={() => setDragId(j.id)} onClick={() => openJob(j.id)}><b>{j.service_requested}</b><span className="m">{j.contact_name} · {money(j.value)}<br />{j.labor_hours ? `⏱ ${j.labor_hours}h · ${money(j.labor_cost)} labor (${j.labor_pct ?? 0}%)` : "no time logged"} · 📄 {j.docs_received}/{j.docs_total} docs{(j as any).requires_site_visit ? <><br />📍 site visit required</> : null}{j.scheduled_start ? <><br />🗓 {String(j.scheduled_start).slice(0, 10)} · {String(j.scheduled_start).slice(11, 16)}</> : null}</span>{nx && <button className="qact" onClick={e => { e.stopPropagation(); advance(j); }}>⏭ {nx.replaceAll("_", " ")}</button>}</div>; })}
    </div>)}</div>
    {jobs.length === 0 && <div className="card" style={{ textAlign: "center", padding: 30 }}><h3 style={{ margin: "4px 0" }}>No jobs yet</h3><p className="muted">Jobs are born the moment a proposal is signed (or a lead is marked Won). Win something and it lands here, ready to schedule.</p></div>}
  </div>);
}


function Avatar({ u, size = 30 }: any) {
  if (u?.avatar_url) return <img className="avatar" style={{ width: size, height: size }} src={u.avatar_url} alt={u?.name || ""} />;
  const ini = String(u?.name || "?").trim().split(/\s+/).map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
  return <span className="avatar avatarIni" style={{ width: size, height: size, fontSize: Math.max(10, size * 0.4) }}>{ini}</span>;
}

function JobChat({ jobId, me, users }: any) {
  const [msgs, setMsgs] = useState<any[]>([]); const [draft, setDraft] = useState(""); const [mids, setMids] = useState<string[]>([]);
  const [query, setQuery] = useState<string | null>(null); const boxRef = useRef<any>(null);
  const load = () => { api("/api/jobs/" + jobId + "/messages").then(r => setMsgs(r.messages || [])).catch(() => {}); };
  useEffect(load, [jobId]);
  useEffect(() => { const el = boxRef.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs.length]);
  const team = (users || []).filter((u: any) => u.active !== 0);
  const candidates = query === null ? [] : team.filter((u: any) => u.id !== me?.id && u.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6);
  const onType = (v: string) => { setDraft(v); const mm = v.match(/@([\w ]*)$/); setQuery(mm ? mm[1] : null); };
  const pick = (u: any) => { setDraft(d => d.replace(/@([\w ]*)$/, "@" + u.name + " ")); setMids(x => [...new Set([...x, u.id])]); setQuery(null); };
  const send = async () => { if (!draft.trim()) return; const r = await api("/api/jobs/" + jobId + "/messages", { method: "POST", body: { body: draft, mention_ids: mids } }); setMsgs(x => [...x, r.message]); setDraft(""); setMids([]); setQuery(null); };
  const renderBody = (msg: any) => {
    let parts: any[] = [msg.body]; let mentions: string[] = []; try { mentions = JSON.parse(msg.mentions || "[]"); } catch {}
    for (const mid of mentions) { const u = team.find((t: any) => t.id === mid); if (!u) continue; const tag = "@" + u.name; const next: any[] = []; for (const p of parts) { if (typeof p !== "string") { next.push(p); continue; } const segs = p.split(tag); segs.forEach((s: string, i: number) => { if (i > 0) next.push(<b className="mention" key={mid + i}>@{u.name}</b>); if (s) next.push(s); }); } parts = next; }
    return parts;
  };
  return (<div className="chatBox">
    <div className="chatMsgs" ref={boxRef}>{msgs.length === 0 && <p className="muted" style={{ margin: 4 }}>No team messages yet. Coordinate the crew here — type @ to tag someone; they'll get a bell notification.</p>}
      {msgs.map((msg: any) => <div className="chatMsg" key={msg.id}><Avatar u={{ name: msg.user_name, avatar_url: msg.user_avatar }} size={28} /><div className="chatMain"><div className="chatHead"><b>{msg.user_name}</b><span className="muted">{dt(msg.created_at)}</span></div><div className="chatBody">{renderBody(msg)}</div></div></div>)}
    </div>
    <div className="chatComposer">
      {query !== null && candidates.length > 0 && <div className="mentionPicker">{candidates.map((u: any) => <button key={u.id} onClick={() => pick(u)}><Avatar u={u} size={22} /> {u.name} <span className="muted">{u.role}</span></button>)}</div>}
      <input value={draft} onChange={e => onType(e.target.value)} onKeyDown={e => { if (e.key === "Enter") send(); }} placeholder="Message the team on this job… type @ to tag" />
      <button className="btn" onClick={send}>Send</button>
    </div>
  </div>);
}

function ProfileModal({ user, close, onSaved }: any) {
  const [name, setName] = useState(user.name || ""); const [avatar, setAvatar] = useState<string | null>(user.avatar_url || null);
  const [cur, setCur] = useState(""); const [next, setNext] = useState(""); const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const onPhoto = (f: File) => { const rd = new FileReader(); rd.onload = () => { const img = new Image(); img.onload = () => { const c = document.createElement("canvas"); c.width = c.height = 160; const x = c.getContext("2d")!; const s = Math.min(img.width, img.height); x.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 160, 160); setAvatar(c.toDataURL("image/jpeg", 0.85)); }; img.src = String(rd.result); }; rd.readAsDataURL(f); };
  const save = async () => { setErr(""); try { const r = await api("/api/users/me", { method: "PATCH", body: { name, avatar_url: avatar } }); onSaved(r.user); setMsg("Profile saved ✓"); } catch (e: any) { setErr(e.message); } };
  const savePw = async () => { setErr(""); try { await api("/api/users/me/password", { method: "POST", body: { current: cur, next } }); setCur(""); setNext(""); setMsg("Password changed ✓"); } catch (e: any) { setErr(e.message); } };
  return (<div className="modalWrap"><div className="modal" style={{ maxWidth: 460 }}>
    <div className="rowflex" style={{ justifyContent: "space-between" }}><h3 style={{ margin: 0 }}>Your profile</h3><button className="btn ghost small" onClick={close}>✕ Close</button></div>
    {err && <div className="err">{err}</div>}{msg && <div className="okbox">{msg}</div>}
    <div className="rowflex" style={{ gap: 14, marginTop: 12 }}><Avatar u={{ name, avatar_url: avatar }} size={64} /><div><label className="btn ghost small" style={{ cursor: "pointer" }}>📷 Change photo<input type="file" accept="image/*" hidden onChange={e => e.target.files?.[0] && onPhoto(e.target.files[0])} /></label>{avatar && <button className="btn ghost small" onClick={() => setAvatar(null)}>Remove</button>}<p className="muted" style={{ margin: "6px 0 0", fontSize: 12 }}>Square-cropped automatically. Shows next to your name everywhere — chat, approvals, activity.</p></div></div>
    <label className="f">Your name</label><input value={name} onChange={e => setName(e.target.value)} />
    <label className="f">Email</label><input value={user.email} disabled />
    <div className="rowflex" style={{ gap: 10, marginTop: 10 }}><span className="tinyBadge" style={{ background: "#e7f6ec", color: "#14532d" }}>{user.role}</span><span className="muted">{user.workspace_name}</span><span style={{ flex: 1 }} /><span className="muted">Approval limit: <b>{user.role === "OWNER" ? "Unlimited (owner)" : (user.approval_limit > 0 ? money(user.approval_limit) : "Set by role policy")}</b></span></div>
    <div className="rowflex" style={{ marginTop: 14 }}><button className="btn" onClick={save}>Save profile</button><span style={{ flex: 1 }} /><button className="btn ghost" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }).catch(() => {}); location.reload(); }}>⏻ Sign out</button></div>
    <h4 style={{ marginTop: 20 }}>Change password</h4>
    <label className="f">Current password</label><input type="password" value={cur} onChange={e => setCur(e.target.value)} />
    <label className="f">New password (8+ characters)</label><input type="password" value={next} onChange={e => setNext(e.target.value)} />
    <button className="btn ghost" style={{ marginTop: 10 }} onClick={savePw}>Change password</button>
  </div></div>);
}

function JobTimeSheet({ leadId, close, onLogged }: any) {
  const [roster, setRoster] = useState<any[]>([]); const [entries, setEntries] = useState<any[]>([]); const [msg, setMsg] = useState("");
  const [f, setF] = useState<any>({ worker_name: "", entry_date: new Date().toISOString().slice(0, 10), hours: "", note: "" });
  const loadE = () => { api(`/api/leads/${leadId}/labor`).then((l: any) => setEntries(l.entries || [])).catch(() => {}); };
  useEffect(() => { api("/api/workers").then(setRoster).catch(() => {}); loadE(); }, []);
  const save = async () => { if (!f.worker_name.trim() || !(Number(f.hours) > 0)) { setMsg("Pick or type a worker name and the hours first."); return; }
    try { const r = await api(`/api/leads/${leadId}/time`, { method: "POST", body: { worker_name: f.worker_name.trim(), entry_date: f.entry_date, hours: Number(f.hours), note: f.note } });
      toast(r.rated ? `Logged ${r.entry.hours}h for ${r.worker.name} ✓` : `Logged for ${r.worker.name} — no rate class set, costed $0 (Settings → Workers)`);
      setF({ ...f, hours: "", note: "" }); loadE(); onLogged && onLogged();
    } catch (e: any) { setMsg("Not saved: " + e.message); } };
  return (<div className="modalWrap" style={{ zIndex: 70 }}><div className="modal" style={{ maxWidth: 480 }}>
    <div className="rowflex" style={{ justifyContent: "space-between" }}><h3 style={{ margin: 0 }}>⏱ Log time on this job</h3><button className="btn ghost small" onClick={close}>✕</button></div>
    <p className="muted" style={{ margin: "6px 0 10px" }}>A name is all a worker needs — no account, no seat. Hours land on the job's timesheet and labor cost immediately.</p>
    <label className="f">Worker</label>
    <input list="jobRosterNames" placeholder="Worker name — type a new one to add them" value={f.worker_name} onChange={e => setF({ ...f, worker_name: e.target.value })} />
    <datalist id="jobRosterNames">{roster.filter((w: any) => w.active).map((w: any) => <option key={w.id} value={w.name}>{w.class_name || "no class"}</option>)}</datalist>
    <div className="formgrid" style={{ marginTop: 10 }}><div><label className="f">Date</label><input type="date" value={f.entry_date} onChange={e => setF({ ...f, entry_date: e.target.value })} /></div>
    <div><label className="f">Hours</label><input type="number" step="0.25" min="0" placeholder="e.g. 6.5" value={f.hours} onChange={e => setF({ ...f, hours: e.target.value })} /></div></div>
    <div className="rowflex" style={{ marginTop: 8 }}>{[2, 4, 6, 8].map(h => <button key={h} className="btn ghost small" onClick={() => setF({ ...f, hours: String(h) })}>{h}h</button>)}</div>
    <label className="f" style={{ marginTop: 10 }}>Note (optional)</label>
    <input placeholder="What got done…" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} />
    {msg && <div className="err" style={{ marginTop: 10 }}>{msg}</div>}
    <div className="rowflex" style={{ marginTop: 14 }}><button className="btn" onClick={save}>Log time</button><button className="btn ghost" onClick={close}>Done</button></div>
    {entries.length > 0 && <div style={{ marginTop: 16 }}><h4 style={{ margin: "0 0 6px" }}>Recent entries on this job</h4>{entries.slice(0, 6).map((e: any) => <p key={e.id} className="muted" style={{ margin: "3px 0" }}>• {e.worker || e.worker_name || ""} — {e.hours}h · {String(e.entry_date || e.created_at || "").slice(0, 10)}{e.amount ? " · " + money(e.amount) : ""}</p>)}</div>}
  </div></div>);
}

function PacketModal({ jobId, close, onSent }: any) {
  const [pv, setPv] = useState<any>(null); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { api(`/api/jobs/${jobId}/packet/preview`, { method: "POST", body: {} }).then(setPv).catch((e: any) => setErr(e.message)); }, []);
  const sendApp = async () => { setBusy(true); const r = await api(`/api/jobs/${jobId}/packet`, { method: "POST", body: {} }).catch((e: any) => ({ error: e.message })); setBusy(false);
    if (r.error) { toast("Packet not sent: " + r.error); return; }
    toast(r.status === "test_mode" ? "📦 Packet recorded — email is in test mode, so it was NOT delivered. Download it and send it from your own email if it has to go today." : "📦 Job packet sent to the customer ✓"); onSent && onSent(); close(); };
  return (<div className="modalWrap" style={{ zIndex: 70 }}><div className="modal" style={{ maxWidth: 560 }}>
    <div className="rowflex" style={{ justifyContent: "space-between" }}><h3 style={{ margin: 0 }}>📦 Job packet</h3><button className="btn ghost small" onClick={close}>✕</button></div>
    {err && <div className="err" style={{ marginTop: 10 }}>{err} You can still download the packet below and send it yourself.</div>}
    {!pv && !err && <p className="muted">Preparing the packet…</p>}
    {pv && <><p className="muted" style={{ margin: "8px 0 2px" }}>To: <b>{pv.to_name} &lt;{pv.to}&gt;</b></p>
      <p style={{ margin: "2px 0" }}><b>{pv.subject}</b></p>
      <pre style={{ whiteSpace: "pre-wrap", background: "#f7f8f6", border: "1px solid #e3e8e3", borderRadius: 10, padding: 12, fontSize: 13, maxHeight: 220, overflow: "auto" }}>{pv.body}</pre>
      <p style={{ margin: "8px 0 2px" }}><b>The download includes:</b></p>
      <div className="rowflex">{pv.includes.map((i: any, k: number) => <span key={k} className="chip">📄 {i.name}</span>)}</div>
      {pv.email_test_mode && <p className="muted" style={{ marginTop: 10 }}>⚠ Sending from the app is in <b>test mode</b> until the email provider is connected — the packet is recorded but not delivered. Downloading and sending from your own email works today.</p>}
      <div className="rowflex" style={{ marginTop: 14 }}>
        <button className="btn" disabled={busy} onClick={sendApp}>📧 Send from Workpile</button>
        <a className="btn ghost" href={`/api/jobs/${jobId}/packet/download`} onClick={() => { toast("📦 Packet downloaded — send it from your own email"); onSent && onSent(); }}>⬇ Download packet (.zip)</a>
        <button className="btn ghost" onClick={close}>Cancel</button>
      </div></>}
    {err && <div className="rowflex" style={{ marginTop: 14 }}><a className="btn" href={`/api/jobs/${jobId}/packet/download`} onClick={() => { toast("📦 Packet downloaded — send it from your own email"); onSent && onSent(); }}>⬇ Download packet (.zip)</a><button className="btn ghost" onClick={close}>Cancel</button></div>}
  </div></div>);
}

function JobDetail({ id, users, me, priceBook, close, refresh, openLead }: any) {
  const [d, setD] = useState<any>(null); const [tab, setTab] = useState("overview"); const [msg, setMsg] = useState(""); const [timeSheet, setTimeSheet] = useState(false); const [packetOpen, setPacketOpen] = useState(false); const tabsRef = useRef<any>(null);
  const goTab = (t: string) => { setTab(t); setTimeout(() => { try { tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); } catch {} }, 60); };
  const [co, setCo] = useState<any>({ delta_scope: "", delta_total: "" }); const [sched, setSched] = useState<any>({ worker_name: "", work_date: new Date().toISOString().slice(0, 10), note: "" }); const [schedPick, setSchedPick] = useState<any>(null); const [visitPick, setVisitPick] = useState<any>(null); const [gateOff, setGateOff] = useState(false); const kbRef = useRef<any>(null);
  useEffect(() => { const h = (e: KeyboardEvent) => { const t = e.target as HTMLElement; if (t && t.closest("input,textarea,select,[contenteditable]")) return; kbRef.current && kbRef.current(e.key); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, []);
  const load = () => { api("/api/jobs/" + id).then(setD).catch(e => setMsg(e.message)); };
  useEffect(load, [id]);
  useLive(load);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") close(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, []);
  if (!d) return <div className="modalWrap"><div className="modal">Loading job… {msg}</div></div>;
  const j = d.job;
  const visitGateOn = !!(j as any).requires_site_visit && !gateOff && !(d.site_visits || []).some((v: any) => ["scheduled", "completed"].includes(v.status));
  const stageTo = async (st: string) => { if (st === "SCHEDULED" && visitGateOn) { const tmr = new Date(Date.now() + 86400000); setVisitPick({ date: tmr.toISOString().slice(0, 10), time: "09:00", assigned_to: "", notes: "" }); toast("📍 This job needs a site visit first — book it below (or schedule the job anyway)."); return; } if (st === "SCHEDULED" && !j.scheduled_start) { const tmr = new Date(Date.now() + 86400000); setSchedPick({ date: tmr.toISOString().slice(0, 10), time: "09:00" }); return; } await api(`/api/jobs/${id}/stage`, { method: "POST", body: { to: st } }); toast(`Job moved to ${st.replaceAll("_", " ")} ✓`); load(); refresh && refresh(); };
  const JPATH = JOB_STAGES.filter(st => st !== "ON_HOLD" && st !== "CANCELLED"); const JEFF = j.stage === "ON_HOLD" ? "IN_PROGRESS" : j.stage; const JCI = JPATH.indexOf(JEFF); const JPREV = JCI > 0 ? JPATH[JCI - 1] : null; const JNEXT = JCI >= 0 && JCI < JPATH.length - 1 ? JPATH[JCI + 1] : null;
  kbRef.current = (key: string) => { if (key === "ArrowRight" && JNEXT) stageTo(JNEXT); else if (key === "ArrowLeft" && JPREV) stageTo(JPREV); else if (["1", "2", "3", "4"].includes(key)) setTab(["overview", "crew", "schedule", "feed"][Number(key) - 1]); };
  const stageToForce = async () => { if (!j.scheduled_start) { const tmr = new Date(Date.now() + 86400000); setSchedPick({ date: tmr.toISOString().slice(0, 10), time: "09:00" }); return; } await api(`/api/jobs/${id}/stage`, { method: "POST", body: { to: "SCHEDULED" } }); toast("Job moved to SCHEDULED ✓"); load(); refresh && refresh(); };
  const doSchedule = async () => { if (!schedPick) return; const r = await api(`/api/jobs/${id}/stage`, { method: "POST", body: { to: "SCHEDULED", scheduled_start: `${schedPick.date}T${schedPick.time}:00` } }); setSchedPick(null); toast(`🗓 Scheduled for ${schedPick.date} at ${schedPick.time} — crew synced to the Ops schedule${r.scheduling?.crew_scheduled ? ` (${r.scheduling.crew_scheduled} crew)` : ""}, timesheets ready for that week`); load(); refresh && refresh(); };
  return (<div className="modalWrap"><div className="modal">
    <div className="rowflex" style={{ justifyContent: "space-between" }}><h3 style={{ margin: 0 }}>{j.service_requested} — {j.contact_name}</h3><button className="btn ghost small" onClick={close}>✕ Close</button></div>
    <p className="muted" style={{ margin: "6px 0" }}>{j.contact_phone || ""} {j.contact_email ? "· " + j.contact_email : ""} · {j.location || ""} · job value <b style={{ color: "#14532d" }}>{money(j.value)}</b> · labor {money(j.labor_cost)} ({j.labor_pct ?? 0}% of value)</p>
    {d.origin && <div className="crumbs"><span className="clickable" onClick={() => openLead && openLead(d.origin.lead_id)}>🎯 Lead: {d.origin.service_requested || "originating lead"}</span>{d.origin.proposal_id ? <span className="clickable" onClick={() => openLead && openLead(d.origin.lead_id)}>→ 📄 Proposal {money(d.origin.proposal_total)} · {d.origin.proposal_status}</span> : <span className="muted">→ no signed proposal (manual / legacy win)</span>}<span>→ 🔧 This job</span></div>}
    {(() => { const PATH = JOB_STAGES.filter(st => st !== "ON_HOLD" && st !== "CANCELLED"); const eff = j.stage === "ON_HOLD" ? "IN_PROGRESS" : j.stage; const ci = PATH.indexOf(eff); const prev = ci > 0 ? PATH[ci - 1] : null; const next = ci >= 0 && ci < PATH.length - 1 ? PATH[ci + 1] : null; return (<>
    <div className="path">{PATH.map((st, i) => <div key={st} className={`stage ${i < ci ? "done" : ""} ${st === eff ? "cur" : ""}`} onClick={() => stageTo(st)}>{i < ci ? "✓ " : ""}{st.replaceAll("_", " ")}</div>)}</div>
    <div className="rowflex" style={{ margin: "2px 0 6px" }}><span className="muted" style={{ fontSize: 12 }}>Click any stage — jobs move both ways. Current: <b>{j.stage.replaceAll("_", " ")}</b>{j.stage === "ON_HOLD" && <> · <button className="btn ghost small" onClick={() => stageTo("IN_PROGRESS")}>▶ Resume work</button></>}</span><span style={{ flex: 1 }} />{prev && <button className="btn ghost small" onClick={() => stageTo(prev)}>← Back: {prev.replaceAll("_", " ")}</button>}{next && <button className="btn small" onClick={() => stageTo(next)}>Next: {next.replaceAll("_", " ")} →</button>}{j.stage !== "ON_HOLD" && j.stage !== "CLOSED" && j.stage !== "CANCELLED" && <button className="btn ghost small" onClick={() => stageTo("ON_HOLD")}>⏸ Put on hold</button>}</div></>); })()}
    {(() => { const openInv = (d.invoices || []).find((x: any) => ["sent", "partially_paid"].includes(x.status)); const paidInv = (d.invoices || []).find((x: any) => x.status === "paid"); const docsMissing = (d.documents || []).filter((x: any) => x.status !== "received").length; const visits = d.site_visits || []; const vNext = visits.find((v: any) => v.status === "scheduled"); const vDone = visits.some((v: any) => v.status === "completed"); const openVisit = () => { const tmr = new Date(Date.now() + 86400000); setVisitPick({ date: tmr.toISOString().slice(0, 10), time: "09:00", assigned_to: "", notes: "" }); };
      const chips: any[] = [];
      if ((j as any).requires_site_visit || visits.length) chips.push(<span key="v" className={`rdy ${visitGateOn ? "warn" : "ok"}`}>{visitGateOn ? "📍 Visit ⚠ not booked" : vDone ? "📍 Visit ✓ done" : vNext ? `📍 Visit ${dt(vNext.scheduled_at)}` : "📍 Visit —"}</span>);
      chips.push(<span key="s" className={`rdy ${j.scheduled_start ? "ok" : ["AWAITING_SCHEDULING", "SCHEDULED"].includes(j.stage) ? "warn" : ""}`}>{j.scheduled_start ? `🗓 ${String(j.scheduled_start).slice(0, 10)} ${String(j.scheduled_start).slice(11, 16)}` : "🗓 No slot yet"}</span>);
      chips.push(<span key="d" className={`rdy ${docsMissing === 0 && (j as any).docs_total > 0 ? "ok" : docsMissing > 0 ? "warn" : ""}`}>📄 Docs {(j as any).docs_received}/{(j as any).docs_total}{docsMissing > 0 ? ` · ${docsMissing} missing` : ""}</span>);
      if (openInv) chips.push(<span key="i" className="rdy warn">🧾 {openInv.number} · {money(openInv.balance)} due</span>); else if (paidInv) chips.push(<span key="i" className="rdy ok">🧾 {paidInv.number} paid ✓</span>);
      let title = "", hint = ""; const acts: any[] = [];
      const A = (label: string, fn: () => void, primary = false) => acts.push(<button key={label} className={primary ? "btn" : "btn ghost small"} onClick={fn}>{label}</button>);
      if (j.stage === "AWAITING_SCHEDULING") { title = "Get this job on the calendar"; hint = visitGateOn ? "A site visit is required first — book it, then the work slot opens up." : "Pick the work slot; the crew lands on the Ops schedule and the week's timesheets are created automatically."; if (visitGateOn) A("📍 Book the site visit", openVisit, true); else { A("🗓 Pick the work slot", () => stageTo("SCHEDULED"), true); A("📍 Book a visit", openVisit); } A("👥 Assign crew", () => setTab("crew")); }
      else if (j.stage === "SCHEDULED") { title = "Ready to roll"; hint = j.scheduled_start ? `Slot: ${String(j.scheduled_start).slice(0, 10)} · ${String(j.scheduled_start).slice(11, 16)}. Crew is on the Ops schedule for that day.` : "Slot set — crew synced."; A("▶ Start work", () => stageTo("IN_PROGRESS"), true); A("🗓 Reschedule", async () => { const cur = j.scheduled_start ? String(j.scheduled_start) : new Date(Date.now() + 86400000).toISOString(); await api(`/api/jobs/${id}`, { method: "PATCH", body: { scheduled_start: null } }); setSchedPick({ date: cur.slice(0, 10), time: cur.slice(11, 16) || "09:00" }); load(); }); A("👥 Crew & time", () => goTab("crew")); A("⏱ Log time", () => setTimeSheet(true)); A(j.packet_sent_at ? "📦 Packet sent ✓ — resend" : "📦 Send job packet", () => setPacketOpen(true)); }
      else if (j.stage === "IN_PROGRESS") { title = "Work is underway"; hint = "Log time as it happens, drop site photos in, and complete the work when the crew wraps."; A("✓ Mark work completed", () => stageTo("WORK_COMPLETED"), true); A("⏱ Log time", () => setTimeSheet(true)); A("👥 Crew", () => goTab("crew")); A("📷 Photos & files", () => goTab("overview")); }
      else if (j.stage === "WORK_COMPLETED") { title = "Work done — paper it"; hint = docsMissing > 0 ? `${docsMissing} document(s) still outstanding. Chase them now while the job is fresh.` : "All paperwork is in. Move to documentation review."; A("📄 Go to paperwork", () => stageTo("DOCUMENTATION_PENDING"), true); A("⏱ Log time", () => setTimeSheet(true)); A("📄 Review docs", () => goTab("overview")); A("📷 Final photos", () => goTab("overview")); }
      else if (j.stage === "DOCUMENTATION_PENDING") { title = "Documentation check"; hint = docsMissing > 0 ? `${docsMissing} of ${(j as any).docs_total} documents still missing — receive them in Overview & Paperwork.` : "Paperwork complete. This job is ready to bill."; if (docsMissing > 0) { A("📄 Receive paperwork", () => goTab("overview"), true); A("➡ Ready anyway", () => stageTo("READY_TO_INVOICE")); } else A("➡ Ready to invoice", () => stageTo("READY_TO_INVOICE"), true); A("⏱ Log time", () => setTimeSheet(true)); }
      else if (j.stage === "READY_TO_INVOICE") { title = "Time to bill"; hint = openInv ? `${openInv.number} is already open — mark the job invoiced.` : `Create the invoice for ${money(j.value)} — it appears here with a customer pay link you can send, and lands in Reports as real AR.`; if (openInv) A("➡ Mark invoiced", () => stageTo("INVOICED"), true); else A(`🧾 Create invoice (${money(j.value)})`, async () => { try { await api(`/api/jobs/${j.id}/invoice`, { method: "POST", body: {} }); toast("Invoice created ✓"); load(); } catch (e: any) { setMsg(e.message); } }, true); A("⏱ Log time", () => setTimeSheet(true)); }
      else if (j.stage === "INVOICED") { title = openInv ? `Collect ${money(openInv.balance)}` : "Invoiced"; hint = openInv ? `${openInv.number} · balance ${money(openInv.balance)}${openInv.due_at ? " · due " + new Date(openInv.due_at).toLocaleDateString() : ""}. Record payments in Overview & Paperwork.` : "No open balance on this job."; if (openInv) A("💵 Record a payment", () => goTab("overview"), true); else A("✓ Close the job", () => stageTo("CLOSED"), true); A("⏱ Log time", () => setTimeSheet(true)); }
      else if (j.stage === "ON_HOLD") { title = "On hold"; hint = "Paused — resume when the blocker clears."; A("▶ Resume work", () => stageTo("IN_PROGRESS"), true); }
      else if (j.stage === "CLOSED") { title = "🎉 Closed"; hint = "This job is complete. Reopen it any time from the stage bar above."; }
      else if (j.stage === "CANCELLED") { title = "Cancelled"; hint = "This job was cancelled."; }
      return (<div className="deck"><div className="rdyRow">{chips}</div><div className="deckMain"><div style={{ flex: 1, minWidth: 220 }}><b style={{ fontSize: 15 }}>{title}</b><p className="muted" style={{ margin: "3px 0 0", fontSize: 12.5 }}>{hint}</p></div><div className="rowflex">{acts}</div></div><p className="muted deckKeys" style={{ margin: "6px 0 0", fontSize: 11 }}>Keys: ←/→ move stage · 1–4 switch tabs</p></div>); })()}
    {j.scheduled_start && ["SCHEDULED", "IN_PROGRESS"].includes(j.stage) && <p style={{ fontSize: 13, margin: "2px 0 6px" }}>🗓 <b>Scheduled: {String(j.scheduled_start).slice(0, 10)} · {String(j.scheduled_start).slice(11, 16)}</b> <span className="muted">— on the Ops Console crew schedule that day, with timesheets for the week.</span></p>}
    {timeSheet && <JobTimeSheet leadId={j.lead_id} close={() => setTimeSheet(false)} onLogged={load} />}
    {packetOpen && <PacketModal jobId={id} close={() => setPacketOpen(false)} onSent={load} />}
    {schedPick && <div className="card" style={{ background: "#f0fdf4", margin: "6px 0 10px" }}><b>🗓 Schedule this job</b><div className="rowflex" style={{ marginTop: 8 }}><input type="date" value={schedPick.date} onChange={e => setSchedPick({ ...schedPick, date: e.target.value })} /><input type="time" value={schedPick.time} onChange={e => setSchedPick({ ...schedPick, time: e.target.value })} /><button className="btn small" onClick={doSchedule}>Schedule it →</button><button className="btn ghost small" onClick={() => setSchedPick(null)}>Cancel</button></div><p className="muted" style={{ fontSize: 12, margin: "6px 0 0" }}>The job's crew lands on the Ops crew schedule for that day and the week's timesheets are created — one move, whole workflow.</p></div>}
    {msg && <div className="ok">{msg}</div>}
    <div className="card" style={{ margin: "6px 0 10px", background: visitGateOn ? "#fffbeb" : "#f8fafc" }}>
      <div className="rowflex" style={{ justifyContent: "space-between" }}><b>📍 Site visit</b><label className="muted" style={{ fontSize: 12.5, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" style={{ width: "auto" }} checked={!!(j as any).requires_site_visit} onChange={async e => { await api(`/api/jobs/${id}`, { method: "PATCH", body: { requires_site_visit: e.target.checked ? 1 : 0 } }); load(); }} /> Required before work is scheduled</label></div>
      {(d.site_visits || []).length === 0 ? <p className="muted" style={{ margin: "6px 0" }}>No site visit booked for this job. {(j as any).requires_site_visit ? "This job requires one before scheduling — book it here and it lands in Site Visits AND on the crew schedule." : "Not required — schedule the work directly, or book a visit if you need eyes on site first."}</p> :
        (d.site_visits || []).map((v: any) => <p key={v.id} style={{ margin: "5px 0", fontSize: 13.5 }}>📍 <b>{dt(v.scheduled_at)}</b> · {v.status}{v.assignee_name ? " · " + v.assignee_name : ""}{v.notes ? " · " + v.notes : ""} {v.status === "scheduled" && <button className="btn ghost small" onClick={async () => { await api(`/api/site-visits/${v.id}`, { method: "PATCH", body: { status: "completed" } }); toast("Site visit completed ✓"); load(); }}>Mark complete</button>}</p>)}
      {visitPick ? <div className="rowflex" style={{ marginTop: 8 }}><input type="date" value={visitPick.date} onChange={e => setVisitPick({ ...visitPick, date: e.target.value })} /><input type="time" value={visitPick.time} onChange={e => setVisitPick({ ...visitPick, time: e.target.value })} /><select value={visitPick.assigned_to} onChange={e => setVisitPick({ ...visitPick, assigned_to: e.target.value })} style={{ width: 180 }}><option value="">Assign to…</option>{(users || []).filter((u: any) => u.active !== 0).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}</select><input placeholder="Notes (access, gate code…)" value={visitPick.notes} onChange={e => setVisitPick({ ...visitPick, notes: e.target.value })} style={{ flex: 1 }} /><button className="btn small" onClick={async () => { await api(`/api/leads/${j.lead_id}/visits`, { method: "POST", body: { scheduled_at: `${visitPick.date}T${visitPick.time}:00`, assigned_to: visitPick.assigned_to || undefined, notes: visitPick.notes } }); setVisitPick(null); toast("📍 Site visit booked ✓ — it's in Site Visits and on the crew schedule"); load(); refresh && refresh(); }}>Book visit</button><button className="btn ghost small" onClick={() => setVisitPick(null)}>Cancel</button></div> :
        <div className="rowflex" style={{ marginTop: 6 }}><button className="btn ghost small" onClick={() => { const tmr = new Date(Date.now() + 86400000); setVisitPick({ date: tmr.toISOString().slice(0, 10), time: "09:00", assigned_to: "", notes: "" }); }}>📍 Book a site visit</button>{visitGateOn && <button className="btn ghost small" onClick={() => { setGateOff(true); toast("Gate noted — pick the work slot next."); stageToForce(); }}>Schedule the job anyway →</button>}</div>}
    </div>
    <div className="tabs" ref={tabsRef}><button className={tab === "overview" ? "on" : ""} onClick={() => setTab("overview")}>Overview & Paperwork</button><button className={tab === "crew" ? "on" : ""} onClick={() => setTab("crew")}>Crew & Time</button><button className={tab === "schedule" ? "on" : ""} onClick={() => setTab("schedule")}>Schedule ({d.schedule.length})</button><button className={tab === "feed" ? "on" : ""} onClick={() => setTab("feed")}>Feed & Notes</button></div>
    {tab === "overview" && <div>
      <div className="rowflex"><button className="btn small" onClick={() => setPacketOpen(true)}>📦 Job packet — preview, send or download{j.packet_sent_at ? ` — last sent ${new Date(j.packet_sent_at).toLocaleDateString()}` : ""}</button>
        <select value={j.invoice_status} onChange={async e => { await api(`/api/jobs/${id}`, { method: "PATCH", body: { invoice_status: e.target.value } }); load(); }} style={{ width: 200 }}><option value="not_ready">Invoice: not ready</option><option value="ready">Invoice: ready to send</option><option value="sent">Invoice: sent</option><option value="paid">Invoice: paid</option></select>
        <span className="muted">Packet carries scope, schedule, and the paperwork list — “send it over” in one click.</span></div>
      <h4>Paperwork checklist</h4>
      {d.documents.map((doc: any) => <div className="check" key={doc.id}><span className={`st ${doc.status === "received" ? "pass" : "fail"}`}>{doc.status === "received" ? "✓" : "✗"}</span><span style={{ flex: 1 }}>{doc.name}{doc.required ? " (required)" : ""}</span>{doc.status !== "received" && <><button className="btn ghost small" onClick={async () => { const r = await api(`/api/documents/${doc.id}/chase`, { method: "POST", body: {} }).catch((e: any) => ({ error: e.message })); setMsg(r.error ? "Chase failed: " + r.error : `Chase email queued — status: ${r.status}`); }}>Chase it</button><button className="btn ghost small" onClick={async () => { await api(`/api/documents/${doc.id}`, { method: "PATCH", body: { status: "received" } }); load(); }}>Mark received</button></>}</div>)}
      {d.documents.length === 0 && <p className="muted">No documents tracked for this job yet.</p>}
      <h4 style={{ marginTop: 16 }}>💬 Team chat <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>internal — customers never see this · @ tags notify</span></h4>
      <JobChat jobId={id} me={me} users={users} />
      <JobFiles jobId={id} />
      <h4 style={{ marginTop: 16 }}>Invoices</h4>
      {(d.invoices || []).map((inv: any) => <div className="check" key={inv.id}><span style={{ flex: 1 }}><b>{inv.number}</b> · {money(inv.total)} · {inv.status} · balance {money(inv.balance)}{inv.due_at ? ` · due ${new Date(inv.due_at).toLocaleDateString()}` : ""}</span>{inv.balance > 0 && inv.status !== "void" && <><input id={"jpay-" + inv.id} type="number" placeholder="$" style={{ width: 90 }} /><button className="btn ghost small" onClick={async () => { const v = Number((document.getElementById("jpay-" + inv.id) as HTMLInputElement).value); if (!(v > 0)) return; try { await api(`/api/invoices/${inv.id}/payments`, { method: "POST", body: { amount: v } }); toast("Payment recorded ✓"); load(); } catch (e: any) { setMsg(e.message); } }}>Record payment</button></>}
      <div style={{ width: "100%", marginTop: 4 }}><InvoiceActions inv={inv} onDone={load} /></div></div>)}
      {!(d.invoices || []).some((x: any) => ["sent", "partially_paid"].includes(x.status)) && j.stage !== "CANCELLED" && <button className="btn ghost small" onClick={async () => { try { await api(`/api/jobs/${j.id}/invoice`, { method: "POST", body: {} }); toast("Invoice created ✓"); load(); } catch (e: any) { setMsg(e.message); } }}>🧾 Create invoice ({money(j.value)})</button>}
      <h4>Change orders</h4>
      {d.change_orders.map((c: any) => <p key={c.id} style={{ margin: "5px 0" }}><b>{money(c.delta_total)}</b> — {c.delta_scope} · <span className="tinyBadge">{c.status}</span> {c.status === "draft" && <button className="btn ghost small" onClick={async () => { await api(`/api/change-orders/${c.id}/status`, { method: "POST", body: { status: "approved" } }); setMsg("Change order approved — added to the job value ✓"); load(); }}>Approve (adds to job value)</button>}</p>)}
      <div className="rowflex"><input placeholder="Scope change — e.g. extra boring location" value={co.delta_scope} onChange={e => setCo({ ...co, delta_scope: e.target.value })} style={{ flex: 1 }} /><input type="number" placeholder="$ delta" style={{ width: 110 }} value={co.delta_total} onChange={e => setCo({ ...co, delta_total: e.target.value })} /><button className="btn ghost small" disabled={!co.delta_scope} onClick={async () => { await api(`/api/jobs/${id}/change-orders`, { method: "POST", body: { delta_scope: co.delta_scope, delta_total: Number(co.delta_total) || 0 } }); setCo({ delta_scope: "", delta_total: "" }); load(); }}>Add change order</button></div>
      {d.field_reports.length > 0 && <><h4>Recent field reports</h4>{d.field_reports.slice(0, 5).map((f: any) => <p key={f.id} className="muted" style={{ margin: "4px 0" }}>📋 {f.report_date} — {f.manager || "worker"} · {f.status}</p>)}</>}
    </div>}
    {tab === "feed" && <div><FeedPanel type="job" id={id} /><div style={{ marginTop: 16 }}><NotesPanel type="job" id={id} /></div></div>}
    {tab === "crew" && <CrewTime lead={{ id: j.lead_id, sector: j.sector, est_value: j.value, pm_id: j.pm_id }} users={users} reloadLead={load} />}
    {tab === "schedule" && <div>
      <h4 style={{ margin: "2px 0 6px" }}>📍 Site visits</h4>
      {(d.site_visits || []).map((v: any) => <p key={v.id} style={{ margin: "5px 0" }}>📍 {dt(v.scheduled_at)} — <b>{v.assignee_name || "unassigned"}</b> · {v.status}{v.notes ? " · " + v.notes : ""}</p>)}
      {(d.site_visits || []).length === 0 && <p className="muted">No site visits booked — use the 📍 Site visit card above.</p>}
      <h4 style={{ margin: "14px 0 6px" }}>🗓 Crew schedule <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>who is on site, which day — site visits booked above appear here too</span></h4>
      {d.schedule.map((s2: any) => <p key={s2.id} style={{ margin: "5px 0" }}>🗓 {s2.work_date} — <b>{s2.worker}</b>{s2.note ? " · " + s2.note : ""}</p>)}
      {d.schedule.length === 0 && <p className="muted">Nothing scheduled yet.</p>}
      <div className="rowflex" style={{ marginTop: 8 }}><input list="rosterNames2" placeholder="Worker name (roster — no account needed)" value={sched.worker_name} onChange={e => setSched({ ...sched, worker_name: e.target.value })} style={{ minWidth: 240 }} /><input type="date" value={sched.work_date} onChange={e => setSched({ ...sched, work_date: e.target.value })} /><input placeholder="Note" value={sched.note} onChange={e => setSched({ ...sched, note: e.target.value })} style={{ flex: 1 }} /><button className="btn small" disabled={!sched.worker_name.trim()} onClick={async () => { const r = await api("/api/schedule", { method: "POST", body: { lead_id: j.lead_id, worker_name: sched.worker_name.trim(), work_date: sched.work_date, note: sched.note } }).catch((e: any) => ({ error: e.message })); if (r.error) setMsg("Schedule failed: " + r.error); else { setSched({ ...sched, worker_name: "", note: "" }); load(); } }}>Schedule</button></div>
    </div>}
  </div></div>);
}

function LogTimeModal({ close, done }: any) {
  const [leads, setLeads] = useState<any[]>([]); const [roster, setRoster] = useState<any[]>([]); const [msg, setMsg] = useState("");
  const [f, setF] = useState<any>({ lead_id: "", worker_name: "", entry_date: new Date().toISOString().slice(0, 10), hours: "", note: "" });
  useEffect(() => { api("/api/leads?paged=1&page=1&page_size=100&sort=recent").then(r => setLeads(r.items || [])).catch(() => {}); api("/api/workers").then(setRoster).catch(() => {}); }, []);
  const save = async () => { if (!f.lead_id || !f.worker_name.trim() || !(Number(f.hours) > 0)) return setMsg("Pick the job, type the worker's name, enter hours."); const r = await api("/api/time", { method: "POST", body: { lead_id: f.lead_id, worker_name: f.worker_name.trim(), entry_date: f.entry_date, hours: Number(f.hours), note: f.note } }).catch((e: any) => ({ error: e.message })); if (r.error) return setMsg("Failed: " + r.error); setMsg(`Logged ${r.entry.hours}h for ${r.worker.name} — ${money(r.entry.amount)}${r.rated ? "" : " (no rate class — costed $0)"} ✓`); setF({ ...f, hours: "", note: "" }); done && done(); };
  return (<div className="modalWrap"><div className="modal" style={{ maxWidth: 520 }}>
    <div className="rowflex" style={{ justifyContent: "space-between" }}><h3 style={{ margin: 0 }}>⏱ Log time — 10 seconds</h3><button className="btn ghost small" onClick={close}>✕ Close</button></div>
    <p className="muted">Worker = a name. If they're new, they're added to the roster as you type — no account, no seat.</p>
    {msg && <div className={msg.includes("✓") ? "ok" : "err"}>{msg}</div>}
    <label className="f">Job / lead</label>
    <select value={f.lead_id} onChange={e => setF({ ...f, lead_id: e.target.value })}><option value="">Choose the job…</option>{leads.map((l: any) => <option key={l.id} value={l.id}>{l.service_requested} — {l.contact_name} ({l.state.replaceAll("_", " ")})</option>)}</select>
    <label className="f">Worker</label>
    <input list="rosterNamesG" placeholder="Type a name — new names join the roster" value={f.worker_name} onChange={e => setF({ ...f, worker_name: e.target.value })} /><datalist id="rosterNamesG">{roster.filter((w: any) => w.active).map((w: any) => <option key={w.id} value={w.name}>{w.class_name || ""}</option>)}</datalist>
    <div className="rowflex"><span><label className="f">Date</label><input type="date" value={f.entry_date} onChange={e => setF({ ...f, entry_date: e.target.value })} /></span>
      <span><label className="f">Hours</label><input type="number" min="0" step="0.25" value={f.hours} onChange={e => setF({ ...f, hours: e.target.value })} style={{ width: 100 }} /></span>
      <span style={{ flex: 1 }}><label className="f">Note</label><input value={f.note} onChange={e => setF({ ...f, note: e.target.value })} placeholder="Phase, task…" /></span></div>
    <div className="rowflex" style={{ marginTop: 12 }}>{[2, 4, 8].map(h => <button key={h} className="btn ghost small" onClick={() => setF({ ...f, hours: String(h) })}>{h}h</button>)}<button className="btn" onClick={save}>Log time</button></div>
  </div></div>);
}

function WorkersTab() {
  const [workers, setWorkers] = useState<any[]>([]); const [classes, setClasses] = useState<any[]>([]); const [msg, setMsg] = useState("");
  const [nw, setNw] = useState<any>({ name: "", phone: "", labor_class_id: "" }); const [bulk, setBulk] = useState("");
  const load = () => { api("/api/workers").then(setWorkers).catch(() => {}); api("/api/labor-classes").then(setClasses).catch(() => {}); };
  useEffect(load, []);
  return (<div className="card"><h3 style={{ marginTop: 0 }}>Workers — the roster</h3>
    <p className="muted">Everyone who works jobs, by name. Roster workers <b>never need logins and never use seats</b> — seats are only for people who sign in. Team members appear here automatically (linked). Give each worker a labor class so their hours cost correctly.</p>
    {msg && <div className="ok">{msg}</div>}
    <table><thead><tr><th>Name</th><th>Phone</th><th>Labor class</th><th>Type</th><th>Active</th><th></th></tr></thead><tbody>
      {workers.map((w: any) => <tr key={w.id}><td><b>{w.name}</b></td><td>{w.phone || <span className="muted">—</span>}</td>
        <td><select value={w.labor_class_id || ""} onChange={async e => { await api("/api/workers/" + w.id, { method: "PATCH", body: { labor_class_id: e.target.value || null } }); setMsg(`Class set for ${w.name} ✓`); load(); }}><option value="">— No class (hours cost $0) —</option>{classes.map((c: any) => <option key={c.id} value={c.id}>{c.name} ({money(c.private_rate)} priv · {money(c.govt_rate)} govt)</option>)}</select></td>
        <td>{w.linked_user_id ? <span className="tinyBadge">team login</span> : <span className="tinyBadge" style={{ background: "#fef9c3", color: "#854d0e" }}>roster only</span>}</td>
        <td>{w.active ? "✓" : "—"}</td>
        <td><button className="btn ghost small" onClick={async () => { await api("/api/workers/" + w.id, { method: "PATCH", body: { active: !w.active } }); load(); }}>{w.active ? "Deactivate" : "Reactivate"}</button></td></tr>)}
    </tbody></table>
    <div className="rowflex" style={{ marginTop: 12 }}><input placeholder="Worker name — e.g. Mike Torres" value={nw.name} onChange={e => setNw({ ...nw, name: e.target.value })} style={{ flex: 1 }} /><input placeholder="Phone (optional)" value={nw.phone} onChange={e => setNw({ ...nw, phone: e.target.value })} /><select value={nw.labor_class_id} onChange={e => setNw({ ...nw, labor_class_id: e.target.value })}><option value="">Class…</option>{classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button className="btn" disabled={!nw.name.trim()} onClick={async () => { await api("/api/workers", { method: "POST", body: { name: nw.name.trim(), phone: nw.phone, labor_class_id: nw.labor_class_id || undefined } }); setNw({ name: "", phone: "", labor_class_id: "" }); setMsg("Worker added ✓"); load(); }}>Add worker</button></div>
    <label className="f" style={{ marginTop: 14 }}>Bulk add — paste names, one per line</label>
    <textarea rows={3} value={bulk} onChange={e => setBulk(e.target.value)} placeholder={"Carlos M.\nDerek W.\nSam R."} />
    <button className="btn ghost small" style={{ marginTop: 6 }} disabled={!bulk.trim()} onClick={async () => { const r = await api("/api/workers/bulk", { method: "POST", body: { text: bulk } }); setBulk(""); setMsg(`${r.created_or_found} workers on the roster ✓`); load(); }}>Add all names</button>
  </div>);
}

function InboxRulesTab({ users }: any) {
  const [rules, setRules] = useState<any[]>([]); const [msg, setMsg] = useState("");
  const [nr, setNr] = useState<any>({ name: "", match_field: "sender", match_value: "", action: "assign", action_value: "" });
  const load = () => { api("/api/inbox-rules").then(setRules).catch(() => {}); };
  useEffect(load, []);
  return (<div className="card"><h3 style={{ marginTop: 0 }}>Inbox rules — route the pile before it piles up</h3>
    <p className="muted">When mail matches, the rule applies immediately — including to the backlog already sitting there. Example: sender contains <span className="mono">dec.ny.gov</span> → assign to you, because regulatory mail can't wait.</p>
    {msg && <div className="ok">{msg}</div>}
    {rules.map((r: any) => <div className="check" key={r.id}><span className="st pass">✓</span><span style={{ flex: 1 }}><b>{r.name}</b> — when {r.match_field} contains “{r.match_value}” → {r.action.replaceAll("_", " ")}{r.action === "assign" ? " to " + (users.find((u: any) => u.id === r.action_value)?.name || "—") : r.action === "snooze_days" ? " " + r.action_value + "d" : ""}</span><button className="btn ghost small" onClick={async () => { await api("/api/inbox-rules/" + r.id, { method: "DELETE" }); load(); }}>Delete</button></div>)}
    {rules.length === 0 && <p className="muted">No rules yet.</p>}
    <div className="formgrid" style={{ marginTop: 12 }}>
      <div><label className="f">Rule name</label><input value={nr.name} onChange={e => setNr({ ...nr, name: e.target.value })} placeholder="DEC mail to me" /></div>
      <div><label className="f">Match field</label><select value={nr.match_field} onChange={e => setNr({ ...nr, match_field: e.target.value })}><option value="sender">Sender (name or email)</option><option value="subject">Subject</option><option value="body">Subject or body</option><option value="category">Category</option></select></div>
      <div><label className="f">Contains</label><input value={nr.match_value} onChange={e => setNr({ ...nr, match_value: e.target.value })} placeholder="dec.ny.gov" /></div>
      <div><label className="f">Then</label><select value={nr.action} onChange={e => setNr({ ...nr, action: e.target.value })}><option value="assign">Assign to…</option><option value="mark_done">Mark done (noise)</option><option value="snooze_days">Snooze (days)</option></select></div>
      {nr.action === "assign" && <div><label className="f">Assign to</label><select value={nr.action_value} onChange={e => setNr({ ...nr, action_value: e.target.value })}><option value="">Pick a person…</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>}
      {nr.action === "snooze_days" && <div><label className="f">Days</label><input type="number" value={nr.action_value} onChange={e => setNr({ ...nr, action_value: e.target.value })} /></div>}
    </div>
    <button className="btn" style={{ marginTop: 10 }} disabled={!nr.match_value || (nr.action === "assign" && !nr.action_value)} onClick={async () => { const r = await api("/api/inbox-rules", { method: "POST", body: nr }); setMsg(`Rule saved ✓ — applied to ${r.applied_now} open item(s) right away`); setNr({ name: "", match_field: "sender", match_value: "", action: "assign", action_value: "" }); load(); }}>Save rule</button>
  </div>);
}

function TimeGridCard() {
  const [g, setG] = useState<any>(null); const [week, setWeek] = useState(""); const [edits, setEdits] = useState<Record<string, string>>({}); const [msg, setMsg] = useState("");
  const load = (w?: string) => { api("/api/time/grid" + (w ? "?week=" + w : "")).then(r => { setG(r); setWeek(r.week_of); }).catch(() => {}); };
  useEffect(() => { load(); }, []);
  useEffect(() => { const h = () => load(); window.addEventListener("wp-ops", h); return () => window.removeEventListener("wp-ops", h); });
  if (!g) return null;
  const days = [...Array(7)].map((_, i) => new Date(new Date(g.week_of + "T12:00:00").getTime() + i * 86400000).toISOString().slice(0, 10));
  const cellVal = (workerId: string, leadId: string, date: string) => { const key = `${workerId}|${leadId}|${date}`; if (edits[key] !== undefined) return edits[key]; const es = g.entries.filter((e: any) => e.worker_id === workerId && e.lead_id === leadId && e.entry_date === date); return es.length ? String(es.reduce((a: number, e: any) => a + e.hours, 0)) : ""; };
  const jobIds: string[] = [...new Set(g.entries.map((e: any) => e.lead_id))] as string[];
  const save = async () => { const rows: any[] = []; for (const [key, v] of Object.entries(edits)) { const [worker_id, lead_id, entry_date] = key.split("|"); const hrs = Number(v); const existing = g.entries.filter((e: any) => e.worker_id === worker_id && e.lead_id === lead_id && e.entry_date === entry_date).reduce((a: number, e: any) => a + e.hours, 0); if (hrs > existing) rows.push({ lead_id, worker_id, entry_date, hours: hrs - existing }); } if (!rows.length) return setMsg("No new hours to save (the grid only adds — delete entries from the job to correct)."); const r = await api("/api/time/grid", { method: "POST", body: { rows } }); setMsg(`Saved ${r.saved} entries ✓`); setEdits({}); load(week); };
  return (<div className="card"><h3>Weekly time grid — office entry for the whole crew</h3>
    <p className="muted">Week of <input type="date" value={week} onChange={e => load(e.target.value)} style={{ width: 160 }} /> · Rows = workers with hours this week, per job. Type hours into a cell and save — Friday entry for everyone in one pass.</p>
    {msg && <div className="ok">{msg}</div>}
    {jobIds.length === 0 && <p className="muted">No time logged this week yet — log from a job, the Queue, or the ⏱ Log time button, and the grid fills in.</p>}
    {jobIds.map(jid => { const job = g.jobs.find((x: any) => x.lead_id === jid); return <div key={jid} style={{ marginBottom: 14 }}><b>{job?.service_requested || "Job"} — {job?.contact_name || ""}</b>
      <table><thead><tr><th>Worker</th>{days.map(d => <th key={d}>{d.slice(5)}</th>)}<th>Total</th></tr></thead><tbody>
        {g.workers.filter((w: any) => g.entries.some((e: any) => e.lead_id === jid && e.worker_id === w.id)).map((w: any) => <tr key={w.id}><td>{w.name}</td>{days.map(d => <td key={d}><input type="number" min="0" step="0.25" style={{ width: 62 }} value={cellVal(w.id, jid, d)} onChange={e => setEdits({ ...edits, [`${w.id}|${jid}|${d}`]: e.target.value })} /></td>)}<td><b>{days.reduce((a, d) => a + (Number(cellVal(w.id, jid, d)) || 0), 0)}</b></td></tr>)}
      </tbody></table></div>; })}
    {jobIds.length > 0 && <button className="btn" onClick={save}>Save grid additions</button>}
  </div>);
}


// ---------- v4 components (slices 37-46, Salesforce parity) ----------
function FeedPanel({ type, id }: any) {
  const [d, setD] = useState<any>(null); const [text, setText] = useState("");
  const load = () => { api(`/api/feed/${type}/${id}`).then(setD).catch(() => {}); };
  useEffect(load, [type, id]);
  if (!d) return <p className="muted">Loading feed…</p>;
  return (<div>
    <div className="rowflex" style={{ justifyContent: "space-between" }}><b>Team feed — talk about this record, on the record</b>
      <button className="btn ghost small" onClick={async () => { const r = await api(`/api/follow/${type}/${id}`, { method: "POST", body: {} }); setD({ ...d, following: r.following }); }}>{d.following ? "★ Following" : "☆ Follow"}</button></div>
    <p className="muted" style={{ fontSize: 12.5 }}>Followers and anyone you @mention (type @FirstName) get notified. This replaces the hallway conversation — it's on the record forever.</p>
    {(d.posts || []).map((p: any) => <div key={p.id} style={{ borderBottom: "1px solid #eef2f7", padding: "8px 0" }}><b>{p.user_name || "Teammate"}</b> <span className="muted" style={{ fontSize: 12 }}>{dt(p.created_at)}</span><p style={{ margin: "3px 0", whiteSpace: "pre-wrap" }}>{p.body}</p></div>)}
    {(!d.posts || d.posts.length === 0) && <p className="muted">No posts yet.</p>}
    <div className="rowflex" style={{ marginTop: 8 }}><input placeholder="Post an update… @mention to pull someone in" value={text} onChange={e => setText(e.target.value)} style={{ flex: 1 }} onKeyDown={e => { if (e.key === "Enter" && text.trim()) (async () => { const r = await api(`/api/feed/${type}/${id}`, { method: "POST", body: { body: text.trim() } }); setText(""); setD({ ...d, posts: r.posts }); })(); }} />
      <button className="btn small" disabled={!text.trim()} onClick={async () => { const r = await api(`/api/feed/${type}/${id}`, { method: "POST", body: { body: text.trim() } }); setText(""); setD({ ...d, posts: r.posts }); }}>Post</button></div>
  </div>);
}

function NotesPanel({ type, id }: any) {
  const [notes, setNotes] = useState<any[]>([]); const [body, setBody] = useState("");
  const load = () => { api(`/api/notes?entity_type=${type}&entity_id=${id}`).then(setNotes).catch(() => {}); };
  useEffect(load, [type, id]);
  return (<div><b>Notes</b>
    {notes.map((n: any) => <div key={n.id} style={{ borderBottom: "1px solid #eef2f7", padding: "7px 0" }}><b>{n.title || "Note"}</b> <span className="muted" style={{ fontSize: 12 }}>· {n.user_name || ""} · {dt(n.created_at)}</span><p style={{ margin: "3px 0", whiteSpace: "pre-wrap" }}>{n.body}</p></div>)}
    {notes.length === 0 && <p className="muted">No notes yet — gate codes, access quirks, who to ask for. Future-you says thanks.</p>}
    <div className="rowflex"><input placeholder="Add a note…" value={body} onChange={e => setBody(e.target.value)} style={{ flex: 1 }} /><button className="btn ghost small" disabled={!body.trim()} onClick={async () => { await api("/api/notes", { method: "POST", body: { entity_type: type, entity_id: id, body: body.trim() } }); setBody(""); load(); }}>Add note</button></div>
  </div>);
}

function CustomFieldsSection({ objectType, entityId, custom, reload }: any) {
  const [defs, setDefs] = useState<any[]>([]); const [vals, setVals] = useState<any>({}); const [msg, setMsg] = useState("");
  useEffect(() => { api(`/api/custom-fields?object=${objectType}`).then((d: any[]) => { setDefs(d); setVals(Object.fromEntries(d.map((f: any) => [f.key, (custom || {})[f.key] ?? ""]))); }).catch(() => {}); }, [objectType, entityId]);
  if (!defs.length) return null;
  return (<div style={{ marginTop: 14 }}><b>Custom fields</b><div className="formgrid" style={{ marginTop: 8 }}>
    {defs.map((f: any) => <div key={f.id}><label className="f">{f.label}</label>
      {f.field_type === "select" ? <select value={vals[f.key] ?? ""} onChange={e => setVals({ ...vals, [f.key]: e.target.value })}><option value="">—</option>{(JSON.parse(f.options || "[]") as string[]).map(o => <option key={o} value={o}>{o}</option>)}</select>
      : f.field_type === "date" ? <input type="date" value={vals[f.key] ?? ""} onChange={e => setVals({ ...vals, [f.key]: e.target.value })} />
      : f.field_type === "number" ? <input type="number" value={vals[f.key] ?? ""} onChange={e => setVals({ ...vals, [f.key]: e.target.value })} />
      : <input value={vals[f.key] ?? ""} onChange={e => setVals({ ...vals, [f.key]: e.target.value })} />}</div>)}
    </div><button className="btn ghost small" style={{ marginTop: 8 }} onClick={async () => { await api("/api/custom-values", { method: "POST", body: { object_type: objectType, entity_id: entityId, values: vals } }); setMsg("Custom fields saved ✓"); reload && reload(); }}>Save custom fields</button>{msg && <span className="muted" style={{ marginLeft: 8 }}>{msg}</span>}</div>);
}

function Planner({ openLead, tabSignal }: any) {
  const [tab, setTab] = useState("tasks");
  useEffect(() => { if (tabSignal?.view === "planner" && tabSignal.tab) setTab(tabSignal.tab); }, [tabSignal]);
  return (<div><h2 className="pt">Planner</h2><p className="sub">Tasks and calendar together — what needs doing, and when. Click a day in the calendar to see its full agenda.</p>
    <div className="tabs"><button className={tab === "tasks" ? "on" : ""} onClick={() => setTab("tasks")}>Tasks</button><button className={tab === "calendar" ? "on" : ""} onClick={() => setTab("calendar")}>Calendar</button></div>
    {tab === "tasks" ? <TasksApp openLead={openLead} embedded /> : <CalendarView openLead={openLead} embedded />}
  </div>);
}

function CompanyDocsCard() {
  const [docs, setDocs] = useState<any[]>([]); const [wsId, setWsId] = useState(""); const [pending, setPending] = useState<any>(null); const [editId, setEditId] = useState(""); const [editName, setEditName] = useState("");
  const load = () => { api("/api/workspaces").then((w: any) => { setWsId(w.current); return api(`/api/attachments?entity_type=workspace&entity_id=${w.current}`); }).then(setDocs).catch(() => {}); };
  useEffect(() => { load(); }, []);
  const DTYPES = [["w9", "W-9"], ["insurance", "Insurance certificate"], ["license", "License"], ["other", "Other document"]];
  const savePending = async () => { const f: File = pending.file; const buf = await f.arrayBuffer(); const bytes = new Uint8Array(buf); let bin = ""; for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192)); await api("/api/attachments", { method: "POST", body: { entity_type: "workspace", entity_id: wsId, name: pending.name || f.name, mime: f.type || "application/octet-stream", doc_type: pending.type, data_base64: btoa(bin) } }); setPending(null); toast("Company document saved ✓"); load(); };
  const patch = async (id: string, body: any) => { await api("/api/attachments/" + id, { method: "PATCH", body }); load(); };
  return (<div className="card" style={{ marginBottom: 14 }}><h3 style={{ marginTop: 0 }}>🏢 Company documents — the vault</h3>
    <p className="muted">Your W-9, insurance certificate, licenses and any document customers ask for. <b>Every document gets a clear name and a type</b> — that is how the AI finds the right one when an email asks for it, and how anyone on the team identifies it later. A badly named file ("scan001.pdf") only works once it's classified here.</p>
    {docs.map(d => <div key={d.id} className="rowflex" style={{ padding: "4px 0", borderTop: "1px solid #eef2f7" }}><span style={{ flex: 1 }}>📄 {editId === d.id ? <span className="rowflex"><input value={editName} onChange={e => setEditName(e.target.value)} style={{ width: 260 }} /><button className="btn small" onClick={async () => { await patch(d.id, { name: editName }); setEditId(""); }}>Save name</button></span> : <><b>{d.name}</b> <button className="btn ghost small" title="Rename" onClick={() => { setEditId(d.id); setEditName(d.name); }}>✎</button></>} <span className="muted">· {Math.max(1, Math.round((d.size || 0) / 1024))} KB · {new Date(d.created_at).toLocaleDateString()}</span></span>
      <select value={d.doc_type || "other"} onChange={e => patch(d.id, { doc_type: e.target.value })} style={{ width: 180 }}>{DTYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <a className="btn ghost small" href={`/api/attachments/${d.id}/download`}>⬇ Download</a><button className="btn ghost small" onClick={async () => { if (confirm("Remove " + d.name + " from the vault?")) { await api("/api/attachments/" + d.id, { method: "DELETE" }); load(); } }}>Remove</button></div>)}
    {docs.length === 0 && !pending && <p className="muted">Nothing here yet — upload your W-9 first; it's the document customers ask for most.</p>}
    {pending ? <div className="card" style={{ marginTop: 10, padding: "10px 14px", background: "#f6f8f6" }}><b>Name it + classify it</b><div className="rowflex" style={{ marginTop: 8 }}><input value={pending.name} onChange={e => setPending({ ...pending, name: e.target.value })} style={{ flex: 1 }} placeholder="Document name — e.g. Form W-9 (2026)" /><select value={pending.type} onChange={e => setPending({ ...pending, type: e.target.value })} style={{ width: 200 }}>{DTYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select><button className="btn" onClick={savePending}>Save to vault</button><button className="btn ghost" onClick={() => setPending(null)}>Cancel</button></div></div>
    : <label className="btn" style={{ cursor: "pointer", marginTop: 8, display: "inline-block" }}>⬆ Upload a company document<input type="file" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) setPending({ file: f, name: f.name.replace(/\.[a-z0-9]+$/i, ""), type: /w-?9/i.test(f.name) ? "w9" : /insur|coi/i.test(f.name) ? "insurance" : /licen/i.test(f.name) ? "license" : "other" }); e.target.value = ""; }} /></label>}
  </div>);
}

function Library({ openLead, openJob, openCustomer, tabSignal }: any) {
  const [tab, setTab] = useState("notes");
  useEffect(() => { if (tabSignal?.view === "library" && tabSignal.tab) setTab(tabSignal.tab); }, [tabSignal]);
  return (<div><h2 className="pt">Library</h2><p className="sub">Notes and files from every record, in one place.</p>
    <CompanyDocsCard />
    <div className="tabs"><button className={tab === "notes" ? "on" : ""} onClick={() => setTab("notes")}>Notes</button><button className={tab === "files" ? "on" : ""} onClick={() => setTab("files")}>Files & Documents</button></div>
    {tab === "notes" ? <NotesApp openLead={openLead} openJob={openJob} openCustomer={openCustomer} embedded /> : <FilesApp openLead={openLead} openJob={openJob} embedded />}
  </div>);
}

function Customers({ openCustomer, tabSignal }: any) {
  const [ctab, setCtab] = useState("customers");
  useEffect(() => { if (tabSignal?.view === "customers" && tabSignal.tab) setCtab(tabSignal.tab); }, [tabSignal]);
  const [rows, setRows] = useState<any[]>([]); const [q, setQ] = useState(""); const [form, setForm] = useState<any>({ name: "", phone: "", email: "" });
  const load = () => { api("/api/accounts").then(setRows).catch(() => {}); };
  useEffect(load, []);
  const list = rows.filter(a => !q || (a.name + a.email).toLowerCase().includes(q.toLowerCase()));
  if (ctab === "people") return (<div><h2 className="pt">Customers & People</h2><div className="tabs"><button className="" onClick={() => setCtab("customers")}>Customers</button><button className="on" onClick={() => setCtab("people")}>People</button></div><People embedded /></div>);
  return (<div><h2 className="pt">Customers & People</h2><div className="tabs"><button className="on" onClick={() => setCtab("customers")}>Customers</button><button className="" onClick={() => setCtab("people")}>People</button></div><p className="sub">Every company you've won (or are building a relationship with) — leads convert into customers automatically when they sign. Lifetime value is real job value, not estimates.</p>
    <div className="rowflex" style={{ marginBottom: 10 }}><input placeholder="Search customers…" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 300 }} /><span className="muted">{list.length} customers · {money(list.reduce((a, x) => a + (x.lifetime_value || 0), 0))} lifetime value</span></div>
    <div className="card" style={{ padding: 6 }}><table><thead><tr><th>Customer</th><th>People</th><th>Leads</th><th>Jobs</th><th>Lifetime value</th><th>Since</th></tr></thead><tbody>
      {list.map(a => <tr key={a.id} className="clickable" onClick={() => openCustomer(a.id)}><td><b>{a.name}</b><br /><span className="muted">{a.email || a.phone || ""}</span></td><td>{a.people_count}</td><td>{a.leads_count}</td><td>{a.jobs_count}</td><td><b>{money(a.lifetime_value)}</b></td><td>{dOnly(a.created_at)}</td></tr>)}
      {list.length === 0 && <tr><td colSpan={6} className="muted">No customers yet — win a lead and it converts here automatically, or add one below.</td></tr>}
    </tbody></table></div>
    <div className="card"><h3 style={{ marginTop: 0 }}>Add a customer manually</h3><div className="rowflex"><input placeholder="Company / customer name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ flex: 1 }} /><input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /><input placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /><button className="btn" disabled={!form.name.trim()} onClick={async () => { await api("/api/accounts", { method: "POST", body: form }); setForm({ name: "", phone: "", email: "" }); load(); }}>Add customer</button></div></div>
  </div>);
}

function CustomerDetail({ id, close, openLead, openJob }: any) {
  const [d, setD] = useState<any>(null);
  const load = () => { api("/api/accounts/" + id).then(setD).catch(() => {}); };
  useEffect(load, [id]);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") close(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, []);
  if (!d) return <div className="modalWrap"><div className="modal">Loading customer…</div></div>;
  const a = d.account;
  return (<div className="modalWrap"><div className="modal">
    <div className="rowflex" style={{ justifyContent: "space-between" }}><h3 style={{ margin: 0 }}>{a.name}</h3><span className="rowflex"><button className="btn small" onClick={() => window.open("/api/accounts/" + id + "/dossier", "_blank")}>📁 Client file — print / download</button><button className="btn ghost small" onClick={close}>✕ Close</button></span></div>
    <p className="muted" style={{ margin: "4px 0 0" }}>The client file is the complete, linked record for this customer — every lead, job, site visit, proposal, invoice, payment, document and file — arranged for printing or saving as PDF when you need proof (W-9 requests, old invoices, job disputes).</p>
    <p className="muted" style={{ margin: "6px 0" }}>{a.phone || ""} {a.email ? "· " + a.email : ""} {a.address ? "· " + a.address : ""} · customer since {dOnly(a.created_at)} · <b style={{ color: "#14532d" }}>lifetime value {money(d.lifetime_value)}</b></p>
    <div className="formgrid"><div><label className="f">Phone</label><input defaultValue={a.phone || ""} id="ca_phone" /></div><div><label className="f">Email</label><input defaultValue={a.email || ""} id="ca_email" /></div><div><label className="f">Industry / type</label><input defaultValue={a.industry || ""} id="ca_ind" /></div><div><label className="f">Website</label><input defaultValue={a.website || ""} id="ca_web" /></div></div>
    <button className="btn ghost small" style={{ marginTop: 8 }} onClick={async () => { await api("/api/accounts/" + id, { method: "PATCH", body: { phone: (document.getElementById("ca_phone") as HTMLInputElement).value, email: (document.getElementById("ca_email") as HTMLInputElement).value, industry: (document.getElementById("ca_ind") as HTMLInputElement).value, website: (document.getElementById("ca_web") as HTMLInputElement).value } }); load(); }}>Save customer details</button>
    <h4>People at this customer ({d.contacts.length})</h4>
    {d.contacts.map((c: any) => <p key={c.id} style={{ margin: "4px 0" }}>👤 <b>{c.name}</b> {c.title ? "· " + c.title : ""} <span className="muted">{c.phone || ""} {c.email || ""}</span></p>)}
    <h4>Jobs ({d.jobs.length})</h4>
    {d.jobs.map((j: any) => <p key={j.id} style={{ margin: "4px 0" }} className="clickable" onClick={() => openJob(j.id)}>🔧 <b>{j.service_requested}</b> — {money(j.value)} · <span className="tinyBadge">{j.stage.replaceAll("_", " ")}</span></p>)}
    {d.jobs.length === 0 && <p className="muted">No jobs yet.</p>}
    <h4>Lead history ({d.leads.length})</h4>
    {d.leads.map((l: any) => <p key={l.id} style={{ margin: "4px 0" }} className="clickable" onClick={() => openLead(l.id)}>🎯 <b>{l.service_requested}</b> — {money(l.est_value)} · <Badge s={l.state} /></p>)}
    {(d.timeline || []).length > 0 && <><h4>History — the whole relationship</h4><div style={{ maxHeight: 300, overflowY: "auto" }}>{(d.timeline || []).map((t: any, i: number) => <p key={i} style={{ margin: "4px 0", fontSize: 13 }} className={t.lead_id ? "clickable" : ""} onClick={() => { if (t.job_id && openJob) openJob(t.job_id); else if (t.lead_id) openLead(t.lead_id); }}>{t.icon} {t.text} <span className="muted">· {new Date(t.at).toLocaleDateString()}</span></p>)}</div></>}
    <h4>Proposals ({(d.proposals || []).length}) · {money((d.money360 || {}).proposals_value || 0)} proposed (current versions) · {money((d.money360 || {}).signed_value || 0)} signed · {money((d.money360 || {}).outstanding || 0)} uncollected contract value</h4>
    {(d.proposals || []).map((p: any) => <p key={p.id} style={{ margin: "4px 0" }} className="clickable" onClick={() => openLead(p.lead_id)}>📄 <b>{p.service_requested}</b> — {money(p.total)} · <span className="tinyBadge">{p.status}</span>{p.sent_at ? " · sent " + dOnly(p.sent_at) : ""}{p.signed_at ? " · ✍️ signed " + dOnly(p.signed_at) : ""} →</p>)}
    {(d.proposals || []).length === 0 && <p className="muted">No proposals yet.</p>}
    {(d.invoices || []).length > 0 && <><h4>Invoices ({(d.invoices || []).length}) · {money((d.money360 || {}).invoiced || 0)} invoiced · {money((d.money360 || {}).ar_outstanding || 0)} receivable{(d.money360 || {}).ar_overdue > 0 ? ` · ${money(d.money360.ar_overdue)} OVERDUE` : ""}</h4>{(d.invoices || []).map((i: any) => <div key={i.id} className="rowflex" style={{ margin: "4px 0", fontSize: 13, flexWrap: "wrap" }}><span style={{ flex: 1 }}>{i.number} · {money(i.total)} · {i.status}{i.paid_amount > 0 ? ` · ${money(i.paid_amount)} paid` : ""}{i.due_at ? ` · due ${new Date(i.due_at).toLocaleDateString()}` : ""}</span><InvoiceActions inv={i} onDone={load} /></div>)}</>}
    <h4>Payments · {money((d.money360 || {}).collected || 0)} collected{(d.money360 || {}).refunded ? " · " + money(d.money360.refunded) + " refunded" : ""} · net {money((d.money360 || {}).net_collected || 0)}</h4>
    {(d.payments || []).map((p: any) => <p key={p.id} style={{ margin: "4px 0" }} className="clickable" onClick={() => p.lead_id && openLead(p.lead_id)}>{p.kind === "refund" ? "↩️" : "💳"} {money(p.amount)} · {p.kind} · <span className="tinyBadge">{p.status}</span> · {dOnly(p.created_at)} →</p>)}
    {(d.payments || []).length === 0 && <p className="muted">No payments recorded.</p>}
    <h4>Documents ({(d.documents || []).length})</h4>
    {(d.documents || []).map((doc: any) => <p key={doc.id} style={{ margin: "4px 0" }} className="clickable" onClick={() => { if (doc.job_id && openJob) openJob(doc.job_id); else if (doc.lead_id) openLead(doc.lead_id); }}>📎 {doc.name} · <span className="tinyBadge">{doc.status}</span>{doc.expires_at ? " · expires " + dOnly(doc.expires_at) : ""} →</p>)}
    {(d.documents || []).length === 0 && <p className="muted">No documents on file.</p>}
    <div style={{ marginTop: 14 }}><FeedPanel type="account" id={id} /></div>
    <CustomFieldsSection objectType="account" entityId={id} custom={a.custom} reload={load} />
  </div></div>);
}

function People({ embedded }: any) {
  const [rows, setRows] = useState<any[]>([]); const [accounts, setAccounts] = useState<any[]>([]); const [q, setQ] = useState(""); const [form, setForm] = useState<any>({ name: "", phone: "", email: "", title: "", account_id: "" });
  const load = () => { api("/api/people").then(setRows).catch(() => {}); api("/api/accounts").then(setAccounts).catch(() => {}); };
  useEffect(load, []);
  const list = rows.filter(p => !q || (p.name + p.email + (p.account_name || "")).toLowerCase().includes(q.toLowerCase()));
  return (<div>{!embedded && <><h2 className="pt">People</h2><p className="sub">Every contact across customers and leads — the person behind the company.</p></>}
    <input placeholder="Search people…" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 300, marginBottom: 10 }} />
    <div className="card" style={{ padding: 6 }}><table><thead><tr><th>Name</th><th>Title</th><th>Customer</th><th>Phone</th><th>Email</th><th>Leads</th></tr></thead><tbody>
      {list.map(p => <tr key={p.id}><td><b>{p.name}</b>{p.is_customer ? " ⭐" : ""}</td><td>{p.title || "—"}</td><td>{p.account_name || <span className="muted">—</span>}</td><td>{p.phone || "—"}</td><td>{p.email || "—"}</td><td>{p.leads_count}</td></tr>)}
      {list.length === 0 && <tr><td colSpan={6} className="muted">No people match.</td></tr>}
    </tbody></table></div>
    <div className="card"><h3 style={{ marginTop: 0 }}>Add a person</h3><div className="rowflex"><input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /><input placeholder="Title (Facilities Director…)" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /><input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /><input placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /><select value={form.account_id} onChange={e => setForm({ ...form, account_id: e.target.value })}><option value="">Customer…</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select><button className="btn" disabled={!form.name.trim()} onClick={async () => { await api("/api/people", { method: "POST", body: { ...form, account_id: form.account_id || undefined } }); setForm({ name: "", phone: "", email: "", title: "", account_id: "" }); load(); }}>Add</button></div></div>
  </div>);
}

function Campaigns({ openLead }: any) {
  const [rows, setRows] = useState<any[]>([]); const [openId, setOpenId] = useState(""); const [detail, setDetail] = useState<any>(null); const [leads, setLeads] = useState<any[]>([]); const [pick, setPick] = useState<string[]>([]);
  const [form, setForm] = useState<any>({ name: "", type: "outreach", cost: "" });
  const load = () => { api("/api/campaigns").then(setRows).catch(() => {}); };
  useEffect(() => { load(); api("/api/leads?paged=1&page=1&page_size=100&sort=recent").then(r => setLeads(r.items || [])).catch(() => {}); }, []);
  const expand = async (c: any) => { if (openId === c.id) { setOpenId(""); return; } setOpenId(c.id); setDetail(await api("/api/campaigns/" + c.id).catch(() => null)); };
  return (<div><h2 className="pt">Campaigns</h2><p className="sub">Where leads come from, what they cost, and what they returned. ROI = (won revenue − cost) ÷ cost, from real won values.</p>
    {rows.map(c => <div className="card" key={c.id} style={{ marginBottom: 10 }}><div className="rowflex" style={{ justifyContent: "space-between" }}><div><b style={{ fontSize: 16 }}>{c.name}</b> <span className="tinyBadge">{c.type}</span> <span className="tinyBadge">{c.status}</span><br /><span className="muted">{c.stats.members} members · {c.stats.leads} leads · {c.stats.won} won · pipeline {money(c.stats.pipeline)} · revenue {money(c.stats.revenue)} · cost {money(c.cost)}{c.stats.roi_pct !== null ? ` · ROI ${c.stats.roi_pct}%` : ""}</span></div>
      <button className="btn ghost small" onClick={() => expand(c)}>{openId === c.id ? "Hide" : "Members"}</button></div>
      {openId === c.id && detail && <div style={{ marginTop: 10 }}>
        {detail.members.map((m: any) => <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid #eef2f7" }}><span style={{ flex: 1, minWidth: 0 }} className="clickable" onClick={() => openLead(m.lead_id)}><b>{m.contact_name}</b> — {m.service_requested} · {money(m.est_value)} · <Badge s={m.state} /></span>
          <select style={{ width: 148 }} value={m.status} onChange={async e => { await api("/api/campaign-members/" + m.id, { method: "PATCH", body: { status: e.target.value } }); setDetail(await api("/api/campaigns/" + c.id)); }}><option value="member">member</option><option value="responded">responded</option><option value="engaged">engaged</option><option value="converted">converted</option></select>
          <button className="btn ghost small" onClick={async () => { await api("/api/campaign-members/" + m.id, { method: "DELETE" }); setDetail(await api("/api/campaigns/" + c.id)); load(); }}>Remove</button></div>)}
        <div className="rowflex" style={{ marginTop: 10 }}><select multiple size={4} style={{ flex: 1 }} value={pick} onChange={e => setPick([...e.target.selectedOptions].map(o => o.value))}>{leads.filter(l => !detail.members.some((m: any) => m.lead_id === l.id)).map((l: any) => <option key={l.id} value={l.id}>{l.contact_name} — {l.service_requested} ({l.state})</option>)}</select>
          <button className="btn small" disabled={!pick.length} onClick={async () => { await api(`/api/campaigns/${c.id}/members`, { method: "POST", body: { lead_ids: pick } }); setPick([]); setDetail(await api("/api/campaigns/" + c.id)); load(); }}>Add {pick.length || ""} leads</button></div>
        <p className="muted" style={{ fontSize: 12 }}>Tip: leads created through the API with a campaign_id join automatically.</p></div>}
    </div>)}
    {rows.length === 0 && <div className="card">No campaigns yet — create the first one below (e.g. “Lapsed clients — fall reactivation”, “Google Ads — tank removals”).</div>}
    <div className="card"><h3 style={{ marginTop: 0 }}>New campaign</h3><div className="rowflex"><input placeholder="Campaign name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ flex: 1 }} /><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option>outreach</option><option>ads</option><option>referral</option><option>event</option><option>email</option><option>reactivation</option></select><input type="number" placeholder="Cost $" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} style={{ width: 120 }} /><button className="btn" disabled={!form.name.trim()} onClick={async () => { await api("/api/campaigns", { method: "POST", body: { ...form, cost: Number(form.cost) || 0 } }); setForm({ name: "", type: "outreach", cost: "" }); load(); }}>Create campaign</button></div></div>
  </div>);
}

function TasksApp({ openLead, embedded }: any) {
  const [f, setF] = useState("open"); const [rows, setRows] = useState<any[]>([]);
  const load = () => { api(`/api/tasks-all?filter=${f}`).then(setRows).catch(() => {}); };
  useEffect(load, [f]);
  return (<div>{!embedded && <><h2 className="pt">Tasks</h2><p className="sub">Every open promise across every record — not buried inside leads.</p></>}
    <div className="rowflex" style={{ marginBottom: 10 }}>{[["mine", "Mine"], ["open", "All open"], ["overdue", "Overdue"], ["done", "Done"]].map(([k, l]) => <button key={k} className={`chip ${f === k ? "on" : ""}`} onClick={() => setF(k)}>{l}</button>)}</div>
    {rows.map(t => <div key={t.id} className="card" style={{ padding: "9px 14px", marginBottom: 7, display: "flex", gap: 10, alignItems: "center" }}><div style={{ flex: 1 }} className="clickable" onClick={() => t.lead_id && openLead(t.lead_id)}><b>{t.title}</b><br /><span className="muted">{t.contact_name || ""} — {t.service_requested || ""} · {t.assignee_name || "unassigned"} · due {dOnly(t.due_at)}{t.due_at && t.due_at < new Date().toISOString() && t.status === "open" ? " · ⚠ overdue" : ""}</span></div>
      {t.status === "open" && <><button className="btn ghost small" onClick={async () => { const r = prompt("Snooze until tomorrow — why? (recorded on the task)"); if (r === null) return; await api(`/api/tasks/${t.id}/snooze`, { method: "POST", body: { reason: r } }); load(); }}>💤 Snooze</button><button className="btn ghost small" onClick={async () => { await api(`/api/tasks/${t.id}/complete`, { method: "POST", body: {} }); load(); }}>✓ Done</button></>}
      {t.status === "done" && t.completion_reason ? <span className="tiny muted">reason: {t.completion_reason}</span> : null}</div>)}
    {rows.length === 0 && <div className="card" style={{ textAlign: "center", padding: 26 }}>Nothing here. 🎉</div>}
  </div>);
}

function CalendarView({ openLead, embedded }: any) {
  const [cur, setCur] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [evs, setEvs] = useState<any[]>([]);
  const [sel, setSel] = useState(() => new Date().toISOString().slice(0, 10));
  const [kindF, setKindF] = useState("all");
  const [showDone, setShowDone] = useState(true);
  useEffect(() => { const from = new Date(cur.getFullYear(), cur.getMonth(), 1).toISOString().slice(0, 10); const to = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).toISOString().slice(0, 10); api(`/api/calendar?from=${from}&to=${to}&done=1`).then(setEvs).catch(() => {}); }, [cur]);
  const y = cur.getFullYear(), m = cur.getMonth(); const first = new Date(y, m, 1).getDay(); const days = new Date(y, m + 1, 0).getDate();
  const cells: any[] = [...Array(first).fill(null), ...[...Array(days)].map((_, i) => i + 1)];
  const dstr = (d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const KINDS: Record<string, [string, string]> = { task: ["✅", "Task"], task_done: ["☑️", "Task done"], callback: ["📞", "Callback"], schedule: ["👷", "Crew on site"], followup: ["🔁", "Follow-up"], visit: ["📍", "Site visit"], job: ["🛠", "Job starts"] };
  const visible = evs.filter(e => (showDone || e.kind !== "task_done") && (kindF === "all" || e.kind === kindF || (kindF === "task" && e.kind === "task_done")));
  const byDay = (d: number) => visible.filter(e => e.date === dstr(d));
  const dayList = visible.filter(e => e.date === sel).sort((a, b) => (KINDS[a.kind]?.[1] || "").localeCompare(KINDS[b.kind]?.[1] || ""));
  const todayStr = new Date().toISOString().slice(0, 10);
  const counts = (k: string) => evs.filter(e => k === "all" || e.kind === k || (k === "task" && e.kind === "task_done")).length;
  return (<div>{!embedded && <><h2 className="pt">Calendar</h2><p className="sub">Everything dated in the business — tasks, callbacks, crew schedule, follow-ups, site visits. <b>Click a day to see its full agenda</b>; open records from the agenda, never by accident.</p></>}
    <div className="rowflex" style={{ marginBottom: 8 }}><button className="btn ghost small" onClick={() => setCur(new Date(y, m - 1, 1))}>← Prev</button><b style={{ fontSize: 16 }}>{cur.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</b><button className="btn ghost small" onClick={() => setCur(new Date(y, m + 1, 1))}>Next →</button><button className="btn ghost small" onClick={() => { const t = new Date(); setCur(new Date(t.getFullYear(), t.getMonth(), 1)); setSel(todayStr); }}>Today</button><span className="muted">{visible.length} items shown</span>
      <label className="muted" style={{ fontSize: 12.5 }}><input type="checkbox" style={{ width: "auto" }} checked={showDone} onChange={e => setShowDone(e.target.checked)} /> Show completed</label></div>
    <div className="rowflex" style={{ marginBottom: 10 }}>{[["all", "All"], ["task", "Tasks"], ["callback", "Callbacks"], ["schedule", "Crew"], ["followup", "Follow-ups"], ["visit", "Visits"]].map(([k, l]) => <button key={k} className={`chip ${kindF === k ? "on" : ""}`} onClick={() => setKindF(k)}>{l} ({counts(k)})</button>)}</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d} className="muted" style={{ fontSize: 12, textAlign: "center" }}>{d}</div>)}
      {cells.map((d, i) => <div key={i} onClick={() => d && setSel(dstr(d))} style={{ minHeight: 92, background: d ? (sel === dstr(d) ? "#f0fdf4" : "#fff") : "transparent", border: d ? "1px solid #e5e7eb" : "none", borderRadius: 8, padding: 5, cursor: d ? "pointer" : "default", outline: d && sel === dstr(d) ? "2px solid #166534" : d && dstr(d) === todayStr ? "2px solid #94a3b8" : "none" }}>{d && <><b style={{ fontSize: 12 }}>{d}{dstr(d) === todayStr ? " · today" : ""}</b>{byDay(d).slice(0, 3).map(e => <div key={e.id} style={{ fontSize: 11, background: e.kind === "task_done" ? "#f1f5f9" : "#f0fdf4", color: e.kind === "task_done" ? "#64748b" : "inherit", textDecoration: e.kind === "task_done" ? "line-through" : "none", borderRadius: 5, padding: "2px 4px", marginTop: 3, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }} title={e.title + " — " + e.sub}>{KINDS[e.kind]?.[0] || "•"} {e.title}</div>)}{byDay(d).length > 3 && <div className="muted" style={{ fontSize: 11 }}>+{byDay(d).length - 3} more — click the day</div>}</>}</div>)}
    </div>
    <div className="card" style={{ marginTop: 14 }}><h3 style={{ marginTop: 0 }}>📋 Agenda — {new Date(sel + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} ({dayList.length})</h3>
      {dayList.map(e => <div key={e.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: "1px solid #eef2f7" }}><span className="calIc">{KINDS[e.kind]?.[0] || "•"}</span><div style={{ flex: 1, minWidth: 0 }}><b style={{ textDecoration: e.kind === "task_done" ? "line-through" : "none" }}>{e.title}</b> <span className="tinyBadge">{KINDS[e.kind]?.[1] || e.kind}</span><br /><span className="muted">{e.sub}</span></div>
        <span className="calAct">{e.kind === "task" && <button className="btn ghost small" onClick={async () => { await api(`/api/tasks/${e.id.slice(4)}/complete`, { method: "POST", body: {} }); const from = new Date(cur.getFullYear(), cur.getMonth(), 1).toISOString().slice(0, 10); const to = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).toISOString().slice(0, 10); api(`/api/calendar?from=${from}&to=${to}&done=1`).then(setEvs).catch(() => {}); }}>✓ Done</button>}
        {e.lead_id && <button className="btn small" onClick={() => openLead(e.lead_id)}>Open record →</button>}</span></div>)}
      {dayList.length === 0 && <p className="muted">Nothing scheduled this day{kindF !== "all" ? " for this filter" : ""}. Click any other day to see its agenda.</p>}
    </div></div>);
}
function NotesApp({ openLead, openJob, openCustomer, embedded }: any) {
  const [rows, setRows] = useState<any[]>([]);
  const load = () => { api("/api/notes").then(setRows).catch(() => {}); };
  useEffect(load, []);
  const open = (n: any) => { if (!n.entity_id) return; if (n.entity_type === "lead") openLead(n.entity_id); else if (n.entity_type === "job") openJob(n.entity_id); else if (n.entity_type === "account") openCustomer(n.entity_id); };
  return (<div>{!embedded && <><h2 className="pt">Notes</h2><p className="sub">Every note on every record, in one place.</p></>}
    {rows.map(n => <div key={n.id} className="card" style={{ padding: "10px 14px", marginBottom: 8 }}><div className="rowflex" style={{ justifyContent: "space-between" }}><b>{n.title || "Note"}</b><span className="muted" style={{ fontSize: 12 }}>{n.user_name || ""} · {dt(n.created_at)}</span></div>
      <p style={{ margin: "4px 0", whiteSpace: "pre-wrap" }}>{n.body}</p>
      {n.entity_id && <button className="btn ghost small" onClick={() => open(n)}>Open: {n.entity_label}</button>}
      <button className="btn ghost small" onClick={async () => { await api("/api/notes/" + n.id, { method: "DELETE" }); load(); }}>Delete</button></div>)}
    {rows.length === 0 && <div className="card">No notes yet — add them from any record's Feed tab.</div>}
  </div>);
}

function FilesApp({ openLead, openJob, embedded }: any) {
  const [rows, setRows] = useState<any[]>([]); const [f, setF] = useState("all");
  useEffect(() => { api("/api/files").then(setRows).catch(() => {}); }, []);
  const list = rows.filter(x => f === "all" || x.status === f);
  return (<div>{!embedded && <><h2 className="pt">Files & Documents</h2><p className="sub">Paperwork across every lead and job — what's in, what's missing, in one list.</p></>}
    <div className="rowflex" style={{ marginBottom: 10 }}>{[["all", "All"], ["missing", "Missing"], ["received", "Received"]].map(([k, l]) => <button key={k} className={`chip ${f === k ? "on" : ""}`} onClick={() => setF(k)}>{l} ({k === "all" ? rows.length : rows.filter(x => x.status === k).length})</button>)}</div>
    <div className="card" style={{ padding: 6 }}><table><thead><tr><th>Document</th><th>For</th><th>Kind</th><th>Status</th><th></th></tr></thead><tbody>
      {list.map(x => <tr key={x.id + x.kind}><td><b>{x.name}</b>{x.required ? " (required)" : ""}</td><td>{x.contact_name || ""} — {x.service_requested || ""}</td><td>{x.kind}</td><td><span className={`st ${x.status === "received" ? "pass" : "fail"}`}>{x.status}</span></td><td>{x.job_id ? <button className="btn ghost small" onClick={() => openJob(x.job_id)}>Open job</button> : x.lead_id ? <button className="btn ghost small" onClick={() => openLead(x.lead_id)}>Open lead</button> : null}</td></tr>)}
      {list.length === 0 && <tr><td colSpan={5} className="muted">Nothing here.</td></tr>}
    </tbody></table></div></div>);
}

function MergesHistory({ load }: any) {
  const [merges, setMerges] = useState<any[]>([]); const [msg, setMsg] = useState("");
  const loadM = () => { api("/api/duplicates/merges").then(setMerges).catch(() => {}); };
  useEffect(loadM, []);
  if (!merges.length) return null;
  return (<div className="card"><h3 style={{ marginTop: 0 }}>Recent merges — reversible</h3>
    {merges.map(m => <div key={m.id} className="rowflex" style={{ padding: "5px 0", borderBottom: "1px solid #eef2f7" }}><span>Merged into <b>{m.survivor_name || "survivor"}</b> · {dt(m.created_at)}</span>{m.reversed_at ? <span className="chip">reversed {dt(m.reversed_at)}</span> : <button className="btn ghost small" onClick={async () => { if (!confirm("Reverse this merge? The duplicate lead comes back in its pre-merge state; anything moved after the merge stays with the survivor.")) return; const r = await api(`/api/duplicates/merges/${m.id}/reverse`, { method: "POST", body: {} }); setMsg(r.note); loadM(); load(); }}>Reverse merge</button>}</div>)}
    {msg && <div className="ok" style={{ marginTop: 8 }}>{msg}</div>}</div>);
}

function DuplicatesView({ embedded }: any) {
  const [groups, setGroups] = useState<any[]>([]); const [msg, setMsg] = useState("");
  const load = () => { api("/api/duplicates").then(setGroups).catch(() => {}); };
  useEffect(load, []);
  return (<div>{!embedded && <><h2 className="pt">Duplicates</h2><p className="sub">Same phone or email on more than one lead. Merge keeps the oldest record as the survivor and moves everything — tasks, proposals, documents, time, history — onto it. The duplicate closes as DUPLICATE and disappears from lists (Salesforce-style).</p></>}
    {msg && <div className="ok">{msg}</div>}
    {groups.map(g => <div className="card" key={g.key} style={{ marginBottom: 10 }}><b>{g.count} leads</b> <span className="chip" style={{ background: g.match_type === "exact" ? "#e7f6ec" : "#fdf3e0", color: g.match_type === "exact" ? "#157347" : "#9a6a00", fontWeight: 700 }}>{g.match_type === "exact" ? "Exact identity" : "Candidate"} · {Math.round((g.confidence ?? 0.99) * 100)}% match</span> <span className="tiny muted">{(g.signals || ["shared key"]).join(", ")}</span>
      {g.leads.map((l: any, i: number) => <div key={l.id} className="rowflex" style={{ padding: "6px 0", borderBottom: "1px solid #eef2f7" }}><span style={{ flex: 1 }}><b>{l.contact_name}</b> — {l.service_requested} · {money(l.est_value)} · <Badge s={l.state} /> · since {dOnly(l.created_at)}{i === 0 ? " · ⭐ survivor (oldest)" : ""}<br /><span className="tiny muted">📞 {l.contact_phone || "—"} · ✉️ {l.contact_email || "—"}{l.location ? ` · 📍 ${l.location}` : ""}</span></span>
        {i > 0 && <button className="btn small" onClick={async () => { if (!confirm(`Merge this lead into "${g.leads[0].contact_name} — ${g.leads[0].service_requested}"? Everything moves; this copy closes as a duplicate.`)) return; await api(`/api/leads/${l.id}/merge`, { method: "POST", body: { into_id: g.leads[0].id } }); setMsg("Merged ✓ — history consolidated on the survivor"); load(); }}>Merge into survivor</button>}</div>)}
    </div>)}
    <MergesHistory load={load} />
    {groups.length === 0 && <div className="card" style={{ textAlign: "center", padding: 26 }}>No duplicate groups. The database is clean. 🎉</div>}
  </div>);
}

function ReportBuilder() {
  const [cfg, setCfg] = useState<any>({ object_type: "leads", group_by: "state", metric: "count" }); const [rows, setRows] = useState<any[]>([]); const [ran, setRan] = useState(false);
  const run = async (c = cfg) => { const r = await api("/api/reports/build", { method: "POST", body: c }); setRows(r.rows || []); setRan(true); };
  useEffect(() => { run(); }, []);
  const max = Math.max(1, ...rows.map(r => cfg.metric === "value" ? r.value : r.count));
  return (<div className="card"><h3 style={{ marginTop: 0 }}>Report builder — group anything, pin it to the Dashboard</h3>
    <div className="rowflex"><select value={cfg.object_type} onChange={e => { const c = { ...cfg, object_type: e.target.value }; setCfg(c); run(c); }}><option value="leads">Leads</option><option value="jobs">Jobs</option></select>
      <select value={cfg.group_by} onChange={e => { const c = { ...cfg, group_by: e.target.value }; setCfg(c); run(c); }}><option value="state">Group: stage</option><option value="source">Group: source</option><option value="owner">Group: owner</option><option value="service">Group: service</option><option value="month">Group: month created</option><option value="job_stage">Group: job stage</option><option value="sector">Group: sector</option></select>
      <select value={cfg.metric} onChange={e => setCfg({ ...cfg, metric: e.target.value })}><option value="count">Metric: count</option><option value="value">Metric: $ value</option></select>
      <button className="btn small" onClick={() => run()}>Run</button>
      <button className="btn ghost small" onClick={async () => { const t = prompt("Name this dashboard widget", `${cfg.object_type} by ${cfg.group_by}`); if (!t) return; await api("/api/dashboard-pins", { method: "POST", body: { title: t, ...cfg } }); alert("Pinned to the Dashboard ✓"); }}>📌 Pin to Dashboard</button></div>
    {ran && rows.map(r => <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 7 }}><span style={{ width: 190, fontSize: 13 }}>{r.key.replaceAll("_", " ")}</span><div style={{ flex: 1, background: "#eef2f7", borderRadius: 6, height: 18 }}><div style={{ width: `${Math.max(3, ((cfg.metric === "value" ? r.value : r.count) / max) * 100)}%`, background: "#166534", height: 18, borderRadius: 6 }} /></div><b style={{ width: 130, textAlign: "right", fontSize: 13 }}>{cfg.metric === "value" ? money(r.value) : `${num(r.count)} · ${money(r.value)}`}</b></div>)}
    {ran && rows.length === 0 && <p className="muted">No data for that grouping yet.</p>}
  </div>);
}

function DashboardPins() {
  const [pins, setPins] = useState<any[]>([]); const [data, setData] = useState<Record<string, any[]>>({});
  useEffect(() => { api("/api/dashboard-pins").then(async (ps: any[]) => { setPins(ps); const d: Record<string, any[]> = {}; for (const p of ps) { const r = await api("/api/reports/build", { method: "POST", body: { object_type: p.object_type, group_by: p.group_by, metric: p.metric } }).catch(() => ({ rows: [] })); d[p.id] = r.rows || []; } setData(d); }).catch(() => {}); }, []);
  if (!pins.length) return null;
  return (<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12, marginBottom: 14 }}>{pins.map(p => { const rows = (data[p.id] || []).slice(0, 6); const max = Math.max(1, ...rows.map(r => p.metric === "value" ? r.value : r.count)); return <div className="card" key={p.id} style={{ margin: 0 }}><div className="rowflex" style={{ justifyContent: "space-between" }}><b>{p.title}</b><button className="btn ghost small" onClick={async () => { await api("/api/dashboard-pins/" + p.id, { method: "DELETE" }); setPins(pins.filter(x => x.id !== p.id)); }}>✕</button></div>
    {rows.map(r => <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}><span style={{ width: 110, fontSize: 12 }}>{String(r.key).replaceAll("_", " ")}</span><div style={{ flex: 1, background: "#eef2f7", borderRadius: 5, height: 13 }}><div style={{ width: `${Math.max(3, ((p.metric === "value" ? r.value : r.count) / max) * 100)}%`, background: "#166534", height: 13, borderRadius: 5 }} /></div><b style={{ fontSize: 12 }}>{p.metric === "value" ? money(r.value) : num(r.count)}</b></div>)}
    {rows.length === 0 && <p className="muted" style={{ fontSize: 12 }}>No data yet.</p>}</div>; })}</div>);
}

function CustomFieldsTab() {
  const [obj, setObj] = useState("lead"); const [defs, setDefs] = useState<any[]>([]); const [form, setForm] = useState<any>({ label: "", field_type: "text", options: "" }); const [msg, setMsg] = useState("");
  const load = () => { api(`/api/custom-fields?object=${obj}`).then(setDefs).catch(() => {}); };
  useEffect(load, [obj]);
  return (<div className="card"><h3 style={{ marginTop: 0 }}>Custom fields — your fields, on your records</h3>
    <p className="muted">Add the fields your business actually runs on (DEC case numbers, permit IDs, tank sizes…). They appear on the record form immediately and save as real data.</p>
    {msg && <div className="ok">{msg}</div>}
    <div className="rowflex">{[["lead", "Leads"], ["job", "Jobs"], ["account", "Customers"]].map(([k, l]) => <button key={k} className={`chip ${obj === k ? "on" : ""}`} onClick={() => setObj(k)}>{l}</button>)}</div>
    {defs.map(f => <div className="check" key={f.id}><span className="st pass">✓</span><span style={{ flex: 1 }}><b>{f.label}</b> <span className="muted">· {f.field_type} · key {f.key}</span></span><button className="btn ghost small" onClick={async () => { await api("/api/custom-fields/" + f.id, { method: "DELETE" }); load(); }}>Remove</button></div>)}
    {defs.length === 0 && <p className="muted">No custom fields on {obj}s yet.</p>}
    <div className="rowflex" style={{ marginTop: 10 }}><input placeholder="Field label — e.g. DEC Case Number" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} style={{ flex: 1 }} />
      <select value={form.field_type} onChange={e => setForm({ ...form, field_type: e.target.value })}><option value="text">Text</option><option value="number">Number</option><option value="date">Date</option><option value="select">Picklist</option></select>
      {form.field_type === "select" && <input placeholder="Options, comma separated" value={form.options} onChange={e => setForm({ ...form, options: e.target.value })} style={{ flex: 1 }} />}
      <button className="btn" disabled={!form.label.trim()} onClick={async () => { await api("/api/custom-fields", { method: "POST", body: { object_type: obj, label: form.label, field_type: form.field_type, options: form.options ? form.options.split(",").map((x: string) => x.trim()).filter(Boolean) : [] } }); setForm({ label: "", field_type: "text", options: "" }); setMsg("Field added ✓ — it's live on the record form"); load(); }}>Add field</button></div>
  </div>);
}

function AssignmentRulesTab({ users }: any) {
  const [rules, setRules] = useState<any[]>([]); const [msg, setMsg] = useState("");
  const [form, setForm] = useState<any>({ name: "", field: "service", op: "contains", value: "", assign_mode: "user", assign_user_id: "", pool: [] as string[] });
  const load = () => { api("/api/assignment-rules").then(setRules).catch(() => {}); };
  useEffect(load, []);
  return (<div className="card"><h3 style={{ marginTop: 0 }}>Lead assignment rules — route new leads automatically</h3>
    <p className="muted">Rules run top-to-bottom on every new lead (form, import, API). First match wins. Round-robin hands the lead to the pool member with the fewest open leads. With no rule matched, the default owner applies.</p>
    {msg && <div className="ok">{msg}</div>}
    {rules.map(r => <div className="check" key={r.id}><span className={`st ${r.active ? "pass" : "fail"}`}>{r.active ? "✓" : "✗"}</span><span style={{ flex: 1 }}><b>{r.name}</b> — when {r.field} {r.op} “{r.value}” → {r.assign_mode === "round_robin" ? "round-robin pool (" + (JSON.parse(r.pool || "[]") as string[]).length + " people)" : "assign to " + (users.find((u: any) => u.id === r.assign_user_id)?.name || "—")}</span>
      <button className="btn ghost small" onClick={async () => { await api("/api/assignment-rules/" + r.id, { method: "PATCH", body: { active: !r.active } }); load(); }}>{r.active ? "Pause" : "Activate"}</button>
      <button className="btn ghost small" onClick={async () => { await api("/api/assignment-rules/" + r.id, { method: "DELETE" }); load(); }}>Delete</button></div>)}
    {rules.length === 0 && <p className="muted">No rules yet.</p>}
    <div className="formgrid" style={{ marginTop: 12 }}>
      <div><label className="f">Rule name</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Tank work to the tank team" /></div>
      <div><label className="f">When field</label><select value={form.field} onChange={e => setForm({ ...form, field: e.target.value })}><option value="service">Service requested</option><option value="source">Source</option><option value="urgency">Urgency</option><option value="value">Est. value ($)</option></select></div>
      <div><label className="f">Condition</label><select value={form.op} onChange={e => setForm({ ...form, op: e.target.value })}>{form.field === "value" ? <><option value="gte">is at least</option><option value="lte">is at most</option><option value="equals">equals</option></> : <><option value="contains">contains</option><option value="equals">equals</option></>}</select></div>
      <div><label className="f">Value</label><input value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} placeholder={form.field === "service" ? "tank" : form.field === "value" ? "25000" : ""} /></div>
      <div><label className="f">Assign</label><select value={form.assign_mode} onChange={e => setForm({ ...form, assign_mode: e.target.value })}><option value="user">To one person</option><option value="round_robin">Round-robin pool</option></select></div>
      {form.assign_mode === "user" ? <div><label className="f">Person</label><select value={form.assign_user_id} onChange={e => setForm({ ...form, assign_user_id: e.target.value })}><option value="">Pick…</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
      : <div><label className="f">Pool (click to toggle)</label><div className="rowflex">{users.map((u: any) => <button key={u.id} className={`chip ${form.pool.includes(u.id) ? "on" : ""}`} onClick={() => setForm({ ...form, pool: form.pool.includes(u.id) ? form.pool.filter((x: string) => x !== u.id) : [...form.pool, u.id] })}>{u.name}</button>)}</div></div>}
    </div>
    <button className="btn" style={{ marginTop: 10 }} disabled={!form.value || (form.assign_mode === "user" ? !form.assign_user_id : !form.pool.length)} onClick={async () => { await api("/api/assignment-rules", { method: "POST", body: { ...form, name: form.name || "Rule" } }); setForm({ name: "", field: "service", op: "contains", value: "", assign_mode: "user", assign_user_id: "", pool: [] }); setMsg("Rule live ✓ — it applies to the next lead created"); load(); }}>Add rule</button>
  </div>);
}


// ---- Toasts: one feedback pattern everywhere (UX acceptance: Feedback) ----
function toast(msg: string) { window.dispatchEvent(new CustomEvent("wp-toast", { detail: msg })); }
function ToastHost() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { const h = (e: any) => { const id = Math.random().toString(36).slice(2); setItems(x => [...x, { id, msg: e.detail }]); setTimeout(() => setItems(x => x.filter(t => t.id !== id)), 4200); }; window.addEventListener("wp-toast", h); return () => window.removeEventListener("wp-toast", h); }, []);
  return <div className="toastHost">{items.map(t => <div key={t.id} className="toast">{t.msg}</div>)}</div>;
}

function OnlinePill() {
  const [on, setOn] = useState(typeof navigator !== "undefined" ? navigator.onLine : true); const [queued, setQueued] = useState(0);
  useEffect(() => { const read = () => { setOn(navigator.onLine); try { setQueued((JSON.parse(localStorage.getItem("wp_offline_posts") || "[]") as any[]).length); } catch { setQueued(0); } }; read(); const iv = setInterval(read, 4000); window.addEventListener("online", read); window.addEventListener("offline", read); return () => { clearInterval(iv); window.removeEventListener("online", read); window.removeEventListener("offline", read); }; }, []);
  return <span className="tinyBadge" title={on ? "Connected — changes save to the server" : "You're offline — work keeps queuing on this device and sends when you're back"} style={{ background: on ? "#dcfce7" : "#fee2e2", fontSize: 12, padding: "5px 9px" }}>{on ? "🟢 Online" : "🔴 Offline"}{queued > 0 ? ` · ${queued} queued` : ""}</span>;
}

function AgentPanel({ close, focusId }: any) {
  const [prov, setProv] = useState<any>(null); const [text, setText] = useState(""); const [ex, setEx] = useState<any>(null); const [hist, setHist] = useState<any[]>([]); const [sel, setSel] = useState<Set<string>>(new Set()); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const loadHist = () => { api("/api/agent/executions").then(setHist).catch(() => {}); };
  useEffect(() => { api("/api/ai/provider").then(setProv).catch(() => {}); loadHist(); }, []);
  useEffect(() => { if (focusId) api(`/api/agent/executions/${focusId}`).then((r: any) => { setEx(r); setSel(new Set()); }).catch(() => {}); }, [focusId]);
  const triage = async () => { if (busy) return; setBusy(true); setErr(""); try { const r = await api("/api/agent/triage-untouched", { method: "POST", body: {} }); setEx(r); setSel(new Set()); loadHist(); } catch (e: any) { setErr(e.message); } setBusy(false); };
  const run = async (instruction: string, parent?: string) => { if (!instruction.trim() || busy) return; setBusy(true); setErr(""); try { const r = await api("/api/agent/execute", { method: "POST", body: { instruction, parent_id: parent || undefined } }); setEx(r); setSel(new Set()); setText(""); loadHist(); } catch (e: any) { setErr(e.message); } setBusy(false); };
  const decide = async (mode: "approve" | "reject") => { if (!ex || !sel.size) return; setBusy(true); try { const r = await api(`/api/agent/executions/${ex.id}/decide`, { method: "POST", body: mode === "approve" ? { approve: [...sel] } : { reject: [...sel] } }); setEx(r); setSel(new Set()); loadHist(); } catch (e: any) { setErr(e.message); } setBusy(false); };
  const cancel = async () => { if (!ex) return; const r = await api(`/api/agent/executions/${ex.id}/cancel`, { method: "POST", body: {} }); setEx(r); loadHist(); };
  const CB: Record<string, string> = { read: "#e0f2fe", draft: "#fef9c3", execute: "#dcfce7", approval: "#fee2e2" };
  const followParent = ex && ex.status !== "awaiting_approval" ? ex.id : undefined;
  return (<div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 430, maxWidth: "94vw", background: "#fff", boxShadow: "-8px 0 30px rgba(15,40,25,.18)", zIndex: 60, display: "flex", flexDirection: "column" }}>
    <div style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 8 }}><h3 style={{ margin: 0, flex: 1 }}>✦ Workpile Agent</h3><button className="btn ghost small" onClick={close}>✕ Close</button></div>
    <div style={{ padding: "10px 16px", borderBottom: "1px solid #eef2f7", fontSize: 12.5 }} className="muted">{prov ? (prov.configured ? <>Connected: <b>{prov.label}</b>{prov.model ? ` · ${prov.model}` : ""}</> : <>Deterministic mode — <b>no AI provider connected</b>. The agent plans with rules; connect a provider in Automations for generative planning.</>) : "…"}</div>
    <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>
      <div className="rowflex"><input style={{ flex: 1 }} placeholder="Tell the agent what to do…" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") run(text, followParent); }} /><button className="btn" disabled={busy} onClick={() => run(text, followParent)}>{busy ? "Working…" : followParent ? "Follow up" : "Run"}</button></div>
      <div className="chipRow" style={{ marginTop: 8 }}>{["Review my new leads, qualify and assign the best ones", "Prepare proposals for qualified leads", "Recover customers who haven't responded", "Find jobs with missing documents", "How is the business doing?"].map(x => <button key={x} className="chip" onClick={() => run(x)}>{x}</button>)}<button className="chip" style={{ background: "#dcfce7", fontWeight: 700 }} onClick={triage}>⚡ Handle all untouched leads</button><button className="chip" style={{ background: "#dcfce7", fontWeight: 700 }} onClick={() => run("Work my inbox")}>📥 Work my inbox</button></div>
      {err && <div className="err">{err}</div>}
      {ex && <div style={{ marginTop: 14 }}>
        <p style={{ margin: "0 0 4px" }}><b>“{ex.instruction}”</b></p>
        <p className="muted" style={{ margin: "0 0 4px", fontSize: 12 }}>Run by {ex.creator_name || "a teammate"} · {new Date(ex.created_at).toLocaleString()}{ex.decided_by_name ? ` · decided by ${ex.decided_by_name}` : ""}</p>
        <p className="muted" style={{ margin: "0 0 10px", fontSize: 12.5 }}>Status: <b>{String(ex.status).replaceAll("_", " ")}</b> · planner: {ex.planner || "—"}{(ex.tokens_in || ex.tokens_out) ? ` · tokens ${ex.tokens_in}/${ex.tokens_out}` : ""}</p>
        {(ex.plan || []).map((s: any) => <div key={s.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "7px 0", borderTop: "1px solid #eef2f7" }}>
          {s.status === "pending" ? <input type="checkbox" checked={sel.has(s.id)} onChange={() => setSel(prev => { const n = new Set(prev); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; })} style={{ width: 16, height: 16, marginTop: 2 }} /> : <span style={{ width: 16, textAlign: "center" }}>{s.status === "done" ? "✓" : s.status === "failed" ? "✗" : s.status === "rejected" ? "—" : "•"}</span>}
          <div style={{ flex: 1 }}><span className="tinyBadge" style={{ background: CB[s.control] || "#e2e8f0" }}>{s.control}{s.needs_approval ? " · approval" : ""}</span> <b style={{ fontSize: 13.5 }}>{s.label}</b>{s.result && <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{s.result}</div>}</div>
        </div>)}
        {ex.status === "awaiting_approval" && <div className="rowflex" style={{ marginTop: 10 }}>{(() => { const pend = (ex.plan || []).filter((s: any) => s.status === "pending"); const allSel = pend.length > 0 && pend.every((s: any) => sel.has(s.id)); return <button className="btn ghost small" onClick={() => setSel(allSel ? new Set() : new Set(pend.map((s: any) => s.id)))}>{allSel ? "Clear selection" : `Select all ${pend.length} pending`}</button>; })()}<button className="btn small" disabled={!sel.size || busy} onClick={() => decide("approve")}>Approve selected ({sel.size})</button><button className="btn ghost small" disabled={!sel.size || busy} onClick={() => decide("reject")}>Reject selected</button><button className="btn ghost small" onClick={cancel}>Cancel run</button></div>}
        {ex.summary && !["awaiting_approval", "executing", "planning"].includes(ex.status) && <div style={{ background: "#f0fdf4", borderRadius: 8, padding: 10, marginTop: 10, whiteSpace: "pre-wrap", fontSize: 13 }}>{ex.summary}</div>}
      </div>}
      {hist.length > 0 && <div style={{ marginTop: 18 }}><h4 style={{ margin: "0 0 6px" }}>Previous runs</h4>{hist.slice(0, 8).map((h: any) => <p key={h.id} className="clickable" style={{ margin: "5px 0", fontSize: 13 }} onClick={() => { setEx(h); setSel(new Set()); }}>“{h.instruction}” <span className="muted">· {String(h.status).replaceAll("_", " ")} · {new Date(h.created_at).toLocaleString()}</span></p>)}</div>}
    </div>
  </div>);
}

function App() {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key !== "Escape") return; const wraps = document.querySelectorAll(".modalWrap"); const last = wraps[wraps.length - 1] as HTMLElement | undefined; if (!last) return; const btns = Array.from(last.querySelectorAll("button")); const closer = btns.find(b => (b.textContent || "").includes("✕")); if (closer) (closer as HTMLButtonElement).click(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, []);
  const [user, setUser] = useState<any>(null); const [login, setLogin] = useState({ email: "", password: "" }); const [err, setErr] = useState("");
  const [nav, setNav] = useState<Nav>({ view: "queue" }); const [agentOpen, setAgentOpen] = useState(false); const [agentFocus, setAgentFocus] = useState("");
  useEffect(() => { const h = (e: any) => { setAgentFocus(e.detail?.executionId || ""); setAgentOpen(true); }; window.addEventListener("wp-agent", h); return () => window.removeEventListener("wp-agent", h); }, []); const [users, setUsers] = useState<any[]>([]); const [priceBook, setPriceBook] = useState<any[]>([]);
const [sb, setSb] = useState(() => localStorage.getItem("wp_sb") || "open"); const [mOpen, setMOpen] = useState(false);
  const [notifs, setNotifs] = useState<any[]>([]); const [unread, setUnread] = useState(0); const [bellOpen, setBellOpen] = useState(false); const [verifyMsg, setVerifyMsg] = useState("");
  const [profOpen, setProfOpen] = useState(false);
  const [navOpen, setNavOpen] = useState<any>(() => { try { return JSON.parse(localStorage.getItem("wp_nav_groups") || "{}"); } catch { return {}; } });
  const toggleGroup = (g: string) => { const n = { ...navOpen, [g]: navOpen[g] === false ? true : false }; setNavOpen(n); try { localStorage.setItem("wp_nav_groups", JSON.stringify(n)); } catch {} };
const [pending, setPending] = useState(0); const [creating, setCreating] = useState(false); const [leadId, setLeadId] = useState<string | null>(null); const [tick, setTick] = useState(0);
  const [palOpen, setPalOpen] = useState(false); const [helpOpen, setHelpOpen] = useState(false); const [jobOpen, setJobOpen] = useState<string | null>(null); const [ltOpen, setLtOpen] = useState(false); const [custOpen, setCustOpen] = useState<string | null>(null);
  const [appMode, setAppMode] = useState(() => localStorage.getItem("wp_app") || "all"); const [favs, setFavs] = useState<any[]>([]); const [tabSignal, setTabSignal] = useState<any>(null);
  const [theme, setTheme] = useState(() => localStorage.getItem("wp_theme") || "light");
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("wp_theme", theme); }, [theme]);
  useEffect(() => { if (user && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {}); }, [user?.id]);
  useEffect(() => { (window as any).wpLogTime = () => setLtOpen(true); (window as any).wpOpenJob = (id: string) => setJobOpen(id); (window as any).wpOpenLead = (id: string) => openLead(id); (window as any).wpOpenAccount = (id: string) => setCustOpen(id); (window as any).wpGoTab = (view: string, tab: string) => { setTabSignal({ view, tab, n: Date.now() }); go({ view }); }; }, []);
  useEffect(() => { localStorage.setItem("wp_app", appMode); }, [appMode]);
  useEffect(() => { if (user) api("/api/favorites").then(setFavs).catch(() => {}); }, [user, tick]);
  const openLead = (id: string) => { setLeadId(id); try { const r = JSON.parse(localStorage.getItem("wp_recent") || "[]").filter((x: string) => x !== id); r.unshift(id); localStorage.setItem("wp_recent", JSON.stringify(r.slice(0, 6))); } catch {} };
  useEffect(() => { if (!user) return; let gAt = 0;
    const h = (e: KeyboardEvent) => { const t = e.target as HTMLElement; const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalOpen(o => !o); return; }
      if (typing || palOpen) return;
      if (e.key === "Escape") { setHelpOpen(false); return; }
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) { setHelpOpen(o => !o); return; }
      if (e.key === "/") { e.preventDefault(); setPalOpen(true); return; }
      if (e.key.toLowerCase() === "t") { setLtOpen(true); return; }
      if (e.key.toLowerCase() === "n") { setCreating(true); return; }
      if (e.key.toLowerCase() === "g") { gAt = Date.now(); return; }
      if (gAt && Date.now() - gAt < 900) { const m: Record<string, string> = { m: "myday", d: "dashboard", p: "pulse", l: "leads", a: "approvals", r: "reports", s: "settings", b: "billing", q: "queue", j: "jobs" }; const v = m[e.key.toLowerCase()]; if (v) { setNav({ view: v }); gAt = 0; } }
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [user, palOpen]);
  const [workspaces, setWorkspaces] = useState<any[]>([]); const [newWs, setNewWs] = useState("");
  useEffect(() => { if (user) api("/api/workspaces").then(r => setWorkspaces(r.workspaces || [])).catch(() => {}); }, [user?.id]);
  const [bill, setBill] = useState<any>(null);
  useEffect(() => { if (user) api("/api/billing").then(setBill).catch(() => {}); }, [user?.workspace_id]);
  useEffect(() => { api("/api/auth/me").then(r => { setUser(r.user); setWorkspaces(r.workspaces || []); }).catch(() => {}); }, []);
  useEffect(() => { syncOffline(); const on = () => syncOffline(); window.addEventListener("online", on); return () => window.removeEventListener("online", on); }, []);
  useEffect(() => { if (user) api("/api/notifications").then(r => { setNotifs(r.notifications); setUnread(r.unread); }).catch(() => {}); }, [user, tick]);
  useLive(() => setTick(t => t + 1));
  useEffect(() => { if (user) { api("/api/users").then(setUsers).catch(() => {}); api("/api/price-book").then(setPriceBook).catch(() => {}); api("/api/approvals").then(r => setPending(r.length)).catch(() => {}); } }, [user, tick]);
  if (!user) return <Landing onAuth={(u: any) => { setUser(u); }} />;
  const go = (n: Nav) => setNav(n);
  const APPS: Record<string, string[]> = { sales: ["queue", "myday", "dashboard", "pulse", "leads", "proposals", "jobs", "customers", "campaigns", "planner", "library", "reports", "approvals", "ai", "inbox"], ops: ["queue", "jobs", "ops", "planner", "leads", "proposals", "inbox", "library", "handoffs", "imports", "demand"], marketing: ["dashboard", "campaigns", "leads", "customers", "proposals", "imports", "demand", "reports", "library"] };
  const inApp = (v: string) => appMode === "all" || (APPS[appMode] || []).includes(v) || ["settings", "billing", "admin"].includes(v);
  const NavB = ({ v, children, cnt, short, onGo }: any) => !inApp(v) ? null : <button className={nav.view === v ? "on" : ""} title={children} onClick={() => { if (onGo) onGo(); else go({ view: v }); setMOpen(false); }}><span className="nshort">{short}</span><span className="nlab">{children}</span>{cnt ? <span className="cnt">{cnt}</span> : null}</button>;
  const toggleSb = () => { const next = sb === "rail" ? "open" : "rail"; setSb(next); localStorage.setItem("wp_sb", next); };
  const NavGroup = ({ id, label, children }: any) => sb === "rail"
    ? <div className="navGroupRail">{children}</div>
    : (<div className="navSection"><button className="navGroupBtn" onClick={() => toggleGroup(id)}><span>{label}</span><span className="navChev">{navOpen[id] === false ? "▸" : "▾"}</span></button>{navOpen[id] !== false && <div className="navItems">{children}</div>}</div>);
  if (user.workspace_suspended && !user.is_platform_admin) return (<div style={{ maxWidth: 520, margin: "60px auto", padding: "0 16px" }}><div className="card" style={{ textAlign: "center", padding: 28 }}><div style={{ fontSize: 34 }}>⏸</div><h2 style={{ margin: "8px 0" }}>This workspace is suspended</h2><p className="muted">{user.workspace_name} has been suspended by the platform operator. Your data is safe — contact the operator to restore access, or switch to another workspace.</p><div className="rowflex" style={{ justifyContent: "center", marginTop: 14 }}>{workspaces.filter((w: any) => w.id !== user.workspace_id).map((w: any) => <button key={w.id} className="btn ghost" onClick={async () => { await api("/api/workspaces/switch", { method: "POST", body: { workspace_id: w.id } }); location.reload(); }}>Switch to {w.name}</button>)}<button className="btn ghost" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }).catch(() => {}); location.reload(); }}>⏻ Sign out</button></div></div></div>);
  return (<div>
    {bill?.subscription?.status === "trialing" && <div style={{ background: (bill.trial_days_left ?? 1) <= 3 ? "#fef2f2" : "#fffbeb", color: (bill.trial_days_left ?? 1) <= 3 ? "#991b1b" : "#92400e", padding: "7px 16px", display: "flex", gap: 12, alignItems: "center", fontSize: 13.5, borderBottom: "1px solid #e5e7eb" }}><span style={{ flex: 1 }}>⏳ <b>{bill.subscription.plan ? bill.subscription.plan[0].toUpperCase() + bill.subscription.plan.slice(1) : "Pro"} trial</b> — {bill.trial_days_left > 0 ? `${bill.trial_days_left} day${bill.trial_days_left === 1 ? "" : "s"} left on this workspace` : "this workspace's trial has ended"}. Every workspace carries its own plan.</span><button className="btn small" onClick={() => go({ view: "settings" })}>See plans →</button></div>}
    {user.impersonation && <div style={{ background: "#991b1b", color: "#fff", padding: "8px 16px", display: "flex", gap: 12, alignItems: "center", fontSize: 13.5 }}><span>🕵 <b>Impersonation</b> — viewing as {user.name} ({user.workspace_name}). Started by {user.impersonation.by_name}; ends {dt(user.impersonation.expires_at)}. Everything done in this window is audited.</span><span style={{ flex: 1 }} /><button className="btn small" style={{ background: "#fff", color: "#991b1b", fontWeight: 700 }} onClick={async () => { await api("/api/auth/impersonation/exit", { method: "POST", body: {} }); location.reload(); }}>Exit impersonation</button></div>}
    <div className="layout">
      <ToastHost />
    {mOpen && <div className="scrim" onClick={() => setMOpen(false)} />}
    <aside className={`side ${sb === "rail" ? "rail" : ""} ${mOpen ? "mOpen" : ""}`}><div className="sideHead"><Logo /><button className="collapseBtn" title={sb === "rail" ? "Expand sidebar" : "Collapse sidebar"} onClick={toggleSb}>{sb === "rail" ? "»" : "«"}</button></div><button className="profileCard" onClick={() => setProfOpen(true)} title="Your profile — photo, name, password">
        <Avatar u={user} size={34} />
        {sb !== "rail" && <span className="pcMeta"><b>{user.name}</b><span>{user.role}</span></span>}
      </button>
      <select className="wsSwitch" value={user.workspace_id} onChange={async e => { if (e.target.value === "__new") { const name = prompt("New business / workspace name"); if (name) { await api("/api/workspaces", { method: "POST", body: { name } }); location.reload(); } return; } await api("/api/workspaces/switch", { method: "POST", body: { workspace_id: e.target.value } }); location.reload(); }}>
        {workspaces.map((w: any) => <option key={w.workspace_id} value={w.workspace_id}>{w.name} ({w.role})</option>)}
        <option value="__new">+ New workspace…</option></select>
      {sb !== "rail" && favs.length > 0 && <div style={{ padding: "4px 2px" }}><div className="muted" style={{ fontSize: 11, letterSpacing: 0.4 }}>⭐ FAVORITES</div>{favs.slice(0, 6).map(f => <button key={f.id} className="favItem" style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: 0, padding: "4px 6px", cursor: "pointer", fontSize: 13 }} onClick={() => { if (f.entity_type === "lead") openLead(f.entity_id); else if (f.entity_type === "job") setJobOpen(f.entity_id); else if (f.entity_type === "account") setCustOpen(f.entity_id); }}>{f.label}</button>)}</div>}
      <NavGroup id="work" label="WORK">
        <NavB v="dashboard" short="🏠">Home</NavB><NavB v="queue" short="🗂">Work Queue</NavB><NavB v="myday" short="☀️">My Day</NavB><NavB v="inbox" short="💬">Inbox</NavB><NavB v="planner" short="✅" onGo={() => { go({ view: "planner" }); (window as any).wpGoTab?.("planner", "tasks"); }}>Tasks</NavB>
      </NavGroup>
      <NavGroup id="pipe" label="PIPELINE">
        <NavB v="leads" short="🎯">Leads</NavB><NavB v="customers" short="👥">Customers</NavB><NavB v="proposals" short="📄">Proposals</NavB><NavB v="approvals" short="🖊" cnt={pending || undefined}>Approvals</NavB>
      </NavGroup>
      <NavGroup id="ops" label="OPERATIONS">
        <NavB v="jobs" short="🛠">Jobs</NavB><NavB v="planner" short="🗓" onGo={() => { go({ view: "planner" }); (window as any).wpGoTab?.("planner", "calendar"); }}>Schedule</NavB><NavB v="ops" short="🖥">Ops Console</NavB>
      </NavGroup>
      <NavGroup id="growth" label="GROWTH">
        <NavB v="campaigns" short="📣">Campaigns</NavB><NavB v="demand" short="🔍">Demand Gap</NavB><NavB v="pulse" short="📊">Pulse</NavB><NavB v="handoffs" short="🤝">Handoffs</NavB><NavB v="library" short="📚">Library</NavB><NavB v="imports" short="📥">Import CSV</NavB>
      </NavGroup>
      <NavGroup id="insights" label="INSIGHTS">
        <NavB v="reports" short="📈">Reports</NavB>
      </NavGroup>
      <NavGroup id="system" label="SYSTEM">
        <NavB v="ai" short="🤖">Automations</NavB><NavB v="settings" short="⚙️">Settings</NavB>
        {user.is_platform_admin ? <NavB v="admin" short="🛡">Platform Admin</NavB> : null}
        {sb !== "rail" && <label className="appModeRow">App view<select value={appMode} onChange={e => setAppMode(e.target.value)} title="Salesforce-style tab sets"><option value="all">All modules</option><option value="sales">Sales</option><option value="ops">Operations</option><option value="marketing">Marketing</option></select></label>}
      </NavGroup>
    </aside>
    <main>
      <div className="topbar"><button className="btn ghost burger" onClick={() => setMOpen(o => !o)}>☰</button><div className="search"><input type="search" readOnly placeholder="Search leads, jump anywhere…  ( ⌘K )" onFocus={() => setPalOpen(true)} /></div>
        <div style={{ position: "relative" }}><button className="btn ghost" onClick={() => setBellOpen(o => !o)}>🔔{unread ? <span className="cnt" style={{ background: "#dc2626", color: "#fff", borderRadius: 99, fontSize: 11, padding: "1px 7px", fontWeight: 700, marginLeft: 4 }}>{unread}</span> : null}</button>
        {bellOpen && <div className="bellPanel"><div className="rowflex" style={{ justifyContent: "space-between" }}><b>Notifications</b><button className="btn ghost small" onClick={async () => { await api("/api/notifications/read-all", { method: "POST", body: {} }); setUnread(0); setNotifs(notifs.map(n => ({ ...n, read_at: n.read_at || "now" }))); }}>Mark all read</button></div>
        <button className="btn ghost small" style={{ margin: "6px 0" }} onClick={async () => { const k = await api("/api/push/key").catch(() => null); if (!k?.configured) { alert("Phone push activates when the server has VAPID keys configured — the in-app bell works today."); return; } const perm = await Notification.requestPermission(); if (perm !== "granted") return; const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(atob(k.public_key.replaceAll("-", "+").replaceAll("_", "/")), c => c.charCodeAt(0)) as any }); await api("/api/push/subscribe", { method: "POST", body: { subscription: sub } }); alert("Phone alerts on for this device ✓"); }}>📱 Enable phone alerts</button>
        {notifs.length === 0 && <p className="muted">Nothing yet \u2014 approvals, signatures, deposits, and new leads land here.</p>}
        {notifs.map(n => <div key={n.id} className="bellItem" style={n.read_at ? {} : { background: "#f0f9f1" }} onClick={async () => { await api(`/api/notifications/${n.id}/read`, { method: "POST", body: {} }).catch(() => {}); setUnread(u => Math.max(0, u - (n.read_at ? 0 : 1))); setNotifs(ns => ns.map(x => x.id === n.id ? { ...x, read_at: x.read_at || "now" } : x)); const et = n.entity_type || (n.lead_id ? "lead" : null); const eid = n.entity_id || n.lead_id; setBellOpen(false); const typ = String(n.type || ""); if (et === "job" && eid) setJobOpen(eid); else if (et === "account" && eid) setCustOpen(eid); else if (et === "ops" || typ.includes("timesheet") || typ.includes("field_report")) go({ view: "ops" }); else if (et === "inbox") go({ view: "inbox" }); else if (typ.startsWith("approval")) go({ view: "approvals" }); else if (typ === "job.mention" && eid) setJobOpen(eid); else if (et === "lead" && eid) openLead(eid); else if (n.lead_id) openLead(n.lead_id); else go({ view: "home" }); }}><b>{n.title}</b><br /><span className="muted">{n.body}</span><br /><span className="muted" style={{ fontSize: 11.5 }}>{dt(n.created_at)} · tap to open →</span></div>)}</div>}</div>
        <button className="btn ghost" title="Toggle dark mode" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}>{theme === "dark" ? "☀️" : "🌙"}</button>
        <OnlinePill /><button className="btn ghost" onClick={() => setAgentOpen(true)}>✦ Agent</button><button className="btn ghost" title="Log time (T)" onClick={() => setLtOpen(true)}>⏱ Log time</button><button className="btn" onClick={() => setCreating(true)}>+ New Lead</button><button className="avatarBtn" onClick={() => setProfOpen(true)} title={"Your profile — " + user.name}><Avatar u={user} size={32} /></button></div>
      {user && user.email_verified === 0 && <div className="verifyBar">✉️ Verify your email to secure your account and enable password recovery. <button className="btn ghost small" onClick={async () => { const r = await api("/api/auth/resend-verify", { method: "POST", body: {} }).catch((e: any) => ({ error: e.message })); setVerifyMsg(r.verify_url ? "Test mode \u2014 verify here: " + r.verify_url : r.error ? r.error : "Verification email sent \u2014 check your inbox."); }}>Resend verification</button>{verifyMsg && <span style={{ marginLeft: 8 }}>{verifyMsg}</span>}</div>}
      <EB key={nav.view}>
      {nav.view === "queue" && <WorkQueue openLead={openLead} openJob={(id: string) => setJobOpen(id)} go={go} />}
      {nav.view === "jobs" && <JobsBoard openJob={(id: string) => setJobOpen(id)} signal={tick} onChange={() => setTick(t => t + 1)} />}
      {nav.view === "customers" && <Customers openCustomer={(id: string) => setCustOpen(id)} tabSignal={tabSignal} />}
      {(nav.view === "people") && <Customers openCustomer={(id: string) => setCustOpen(id)} tabSignal={{ view: "customers", tab: "people", n: 1 }} />}
      {nav.view === "campaigns" && <Campaigns openLead={openLead} />}
      {nav.view === "planner" && <Planner openLead={openLead} tabSignal={tabSignal} />}
      {(nav.view === "tasks" || nav.view === "calendar") && <Planner openLead={openLead} tabSignal={{ view: "planner", tab: nav.view === "tasks" ? "tasks" : "calendar", n: 1 }} />}
      {nav.view === "library" && <Library openLead={openLead} openJob={(id: string) => setJobOpen(id)} openCustomer={(id: string) => setCustOpen(id)} tabSignal={tabSignal} />}
      {(nav.view === "notes" || nav.view === "files") && <Library openLead={openLead} openJob={(id: string) => setJobOpen(id)} openCustomer={(id: string) => setCustOpen(id)} tabSignal={{ view: "library", tab: nav.view, n: 1 }} />}
      {nav.view === "duplicates" && <DuplicatesView />}
      {nav.view === "myday" && <MyDay user={user} openLead={openLead} go={go} />}
      {nav.view === "dashboard" && <Dashboard go={go} openLead={openLead} />}
      {nav.view === "pulse" && <Pulse openLead={openLead} />}
      {nav.view === "leads" && <Leads key={JSON.stringify(nav.leads || {}) + tick} initial={nav.leads} openLead={openLead} users={users} me={user} />}
      {nav.view === "reports" && <Reports />}
      {nav.view === "approvals" && <Approvals openLead={openLead} />}
      {nav.view === "proposals" && <ProposalsView openLead={openLead} />}
      {nav.view === "inbox" && <InboxPage />}
      {nav.view === "ai" && <AIAssistant go={go} openLead={(id: string) => setLeadId(id)} openJob={(id: string) => setJobOpen(id)} />}
      {nav.view === "imports" && <Imports />}
      {nav.view === "demand" && <Demand openLead={openLead} />}
      {nav.view === "handoffs" && <Handoffs />}
      {nav.view === "ops" && <Ops />}
      {nav.view === "settings" && <Settings users={users} setUsers={setUsers} priceBook={priceBook} setPriceBook={setPriceBook} onJump={(v: string) => go({ view: v as any })} me={user} />}
      {nav.view === "billing" && <Billing />}
      {nav.view === "admin" && <Admin />}
      </EB>
      {jobOpen && <EB key={"job" + jobOpen}><JobDetail id={jobOpen} users={users} me={user} priceBook={priceBook} close={() => setJobOpen(null)} refresh={() => setTick(t => t + 1)} openLead={(lid: string) => { setJobOpen(null); setLeadId(lid); }} /></EB>}
      {custOpen && <EB key={"cust" + custOpen}><CustomerDetail id={custOpen} close={() => setCustOpen(null)} openLead={openLead} openJob={(id: string) => setJobOpen(id)} /></EB>}
      {agentOpen && <AgentPanel close={() => setAgentOpen(false)} focusId={agentFocus} />}
      {profOpen && <ProfileModal user={user} close={() => setProfOpen(false)} onSaved={(u: any) => setUser({ ...user, ...u })} />}
      {ltOpen && <LogTimeModal close={() => setLtOpen(false)} done={() => setTick(t => t + 1)} />}
      {creating && <CreateLead users={users} done={(id: any) => { setCreating(false); setTick(t => t + 1); if (id) openLead(id); }} />}
      {palOpen && <CommandPalette close={() => setPalOpen(false)} go={go} openLead={openLead} newLead={() => setCreating(true)} />}
      {helpOpen && <div className="modalWrap" onClick={() => setHelpOpen(false)}><div className="card" style={{ maxWidth: 430, margin: "10vh auto" }} onClick={e => e.stopPropagation()}><h3 style={{ marginTop: 0 }}>Keyboard shortcuts</h3><table><tbody>{[["⌘K or /", "Command palette — search + jump"], ["N", "New lead"], ["G then M / D / P / L / A / R / S / B", "Go to My Day / Dashboard / Pulse / Leads / Approvals / Reports / Settings / Billing"], ["?", "This help"], ["Esc", "Close dialogs"]].map(([k, v]) => <tr key={k}><td style={{ whiteSpace: "nowrap" }}><span className="kbd">{k}</span></td><td>{v}</td></tr>)}</tbody></table></div></div>}
      {leadId && <EB key={"lead" + leadId}><LeadDetail id={leadId} users={users} priceBook={priceBook} close={() => setLeadId(null)} refresh={() => setTick(t => t + 1)} openJob={(jid: string) => { setLeadId(null); setJobOpen(jid); }} openApprovals={() => { setLeadId(null); go({ view: "approvals" }); }} /></EB>}
    </main></div></div>);
}
function BookingPage({ slug }: any) {
  const [info, setInfo] = useState<any>(null); const [err, setErr] = useState(""); const [done, setDone] = useState(false);
  const [f, setF] = useState<any>({ name: "", phone: "", email: "", service: "", when: "", notes: "", location: "" });
  useEffect(() => { fetch(`/api/public/book/${slug}`).then(r => r.ok ? r.json() : Promise.reject(new Error("nf"))).then(setInfo).catch(() => setErr("This booking page is not available.")); }, []);
  const submit = async () => { const r = await fetch("/api/public/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, ...f }) }); const j = await r.json().catch(() => ({})); if (!r.ok) { setErr(j.error?.code === "name_and_contact_required" ? "Please add your name and a phone or email." : "Something went wrong — please call us instead."); return; } setDone(true); };
  if (err) return <div className="landWrap"><div className="authCard" style={{ margin: "10vh auto" }}><Logo /><p>{err}</p></div></div>;
  if (!info) return <div className="landWrap"><p className="muted" style={{ textAlign: "center", marginTop: "12vh" }}>Loading…</p></div>;
  if (done) return <div className="landWrap"><div className="authCard" style={{ margin: "10vh auto" }}><Logo /><h2>You're booked ✓</h2><p className="muted">{info.business} has your request{f.when ? ` for ${new Date(f.when).toLocaleString()}` : ""}. We'll confirm shortly — and if anything changes, we'll reach out first.</p></div></div>;
  return (<div className="landWrap"><div className="authCard" style={{ margin: "6vh auto" }}><Logo /><h2 style={{ marginBottom: 2 }}>Book a visit — {info.business}</h2><p className="muted">Pick a time; we'll confirm by text or email.</p>
    <label className="f">Your name</label><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
    <label className="f">Phone</label><input value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} />
    <label className="f">Email</label><input value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
    <label className="f">Service</label><select value={f.service} onChange={e => setF({ ...f, service: e.target.value })}><option value="">Choose…</option>{(info.services || []).map((sv: any) => <option key={sv.name} value={sv.name}>{sv.name}</option>)}</select>
    <label className="f">Preferred date & time</label><input type="datetime-local" value={f.when} onChange={e => setF({ ...f, when: e.target.value })} />
    <label className="f">Address / location</label><input value={f.location} onChange={e => setF({ ...f, location: e.target.value })} />
    <label className="f">Anything we should know?</label><textarea rows={3} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} />
    <button className="btn" style={{ width: "100%", marginTop: 12 }} disabled={!f.name || !(f.phone || f.email)} onClick={submit}>Request this visit</button>
    <p className="muted" style={{ fontSize: 12 }}>By booking you agree we may call/text about this request. No spam, ever.</p></div></div>);
}
const __path = window.location.pathname;
createRoot(document.getElementById("root")!).render(__path.startsWith("/book/") ? <BookingPage slug={__path.split("/")[2]} /> : __path.startsWith("/print/proposal/") ? <PrintProposal id={__path.split("/")[3]} /> : __path.startsWith("/print/status-report") ? <PrintStatusReport /> : <App />);

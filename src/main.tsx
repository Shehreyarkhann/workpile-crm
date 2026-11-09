import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const api = async (path: string, opts: any = {}) => {
  const r = await fetch(path, { method: opts.method || "GET", headers: { "Content-Type": "application/json" }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.message || j.error?.code || r.statusText);
  return j;
};
const BUCKETS: Record<string, string[]> = {
  "New": ["NEW", "TRIAGED"], "Working": ["QUALIFYING", "QUALIFIED", "ON_HOLD"],
  "Waiting on Approver": ["READY_FOR_APPROVAL"], "Proposal Out": ["APPROVED", "PROPOSAL_DRAFTED", "PROPOSAL_SENT", "IN_FOLLOW_UP"],
  "Won": ["WON"], "Closed": ["LOST", "NO_RESPONSE", "UNSERVICEABLE", "JUNK", "DUPLICATE"],
};
const money = (n: number) => "$" + (n || 0).toLocaleString();

function App() {
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState("board");
  const [leads, setLeads] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [brief, setBrief] = useState<any>(null);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [demand, setDemand] = useState<any[]>([]);
  const [handoffs, setHandoffs] = useState<any[]>([]);
  const [ops, setOps] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const [err, setErr] = useState("");
  const [login, setLogin] = useState({ email: "owner@demo.test", password: "demo1234" });

  const load = async () => {
    try {
      const [l, m, b, a, d, h, o] = await Promise.all([api("/api/leads"), api("/api/metrics"), api("/api/brief"), api("/api/approvals"), api("/api/demand-gap"), api("/api/handoffs"), api("/api/ops")]);
      setLeads(l); setMetrics(m); setBrief(b); setApprovals(a); setDemand(d); setHandoffs(h); setOps(o);
    } catch (e: any) { setErr(e.message); }
  };
  useEffect(() => { api("/api/auth/me").then(r => { setUser(r.user); }).catch(() => {}); }, []);
  useEffect(() => { if (user) load(); }, [user]);

  if (!user) return (<div className="login"><h1>LeadFlow OS</h1><p>Backlog → Approval → Proposal → Handoff</p>
    {err && <div className="err">{err}</div>}
    <input value={login.email} onChange={e => setLogin({ ...login, email: e.target.value })} placeholder="Email" />
    <input type="password" value={login.password} onChange={e => setLogin({ ...login, password: e.target.value })} placeholder="Password" />
    <button onClick={async () => { try { const r = await api("/api/auth/login", { method: "POST", body: login }); setUser(r.user); setErr(""); } catch (e: any) { setErr(e.message); } }}>Sign in</button>
    <small>Demo: owner@demo.test / demo1234</small></div>);

  const openLead = async (id: string) => { try { setSelected(await api(`/api/leads/${id}`)); } catch (e: any) { setErr(e.message); } };
  const transition = async (id: string, to: string, extra: any = {}) => { try { await api(`/api/leads/${id}/transition`, { method: "POST", body: { to_state: to, ...extra } }); await load(); if (selected) openLead(id); } catch (e: any) { setErr(e.message); alert(e.message); } };

  return (<div className="shell">
    <aside>
      <h2>LeadFlow OS</h2>
      <p className="who">{user.name} · {user.role}</p>
      {["board", "approvals", "dashboard", "demand", "handoffs", "ops"].map(v => <button key={v} className={view === v ? "nav on" : "nav"} onClick={() => setView(v)}>{v[0].toUpperCase() + v.slice(1)}{v === "approvals" && approvals.length ? ` (${approvals.length})` : ""}</button>)}
      {brief && <div className="brief"><strong>Morning Brief</strong><p>{brief.headline}</p><p>{brief.undelivered_finals} finals not yet picked up by their system</p></div>}
    </aside>
    <main>
      {err && <div className="err">{err}</div>}
      {view === "board" && <>
        <h1>Lead Board</h1>
        <div className="board">{Object.entries(BUCKETS).map(([bucket, states]) => (
          <div className="col" key={bucket}><h3>{bucket}</h3>
            {leads.filter(l => states.includes(l.state)).map(l => (
              <div className="card" key={l.id} onClick={() => openLead(l.id)}>
                <strong>{l.service_requested}</strong><span>{l.contact_name}</span>
                <span>{money(l.est_value)} · {l.state}</span>
                {l.next_action_due_at && <span className={new Date(l.next_action_due_at) < new Date() ? "over" : ""}>Next: {new Date(l.next_action_due_at).toLocaleDateString()}</span>}
              </div>))}
          </div>))}
        </div>
        {selected && <div className="detail">
          <button onClick={() => setSelected(null)}>Close</button>
          <h2>{selected.lead.service_requested} — {selected.lead.contact_name}</h2>
          <p>{selected.lead.notes}</p>
          <p>State: <strong>{selected.lead.state}</strong> · Value: {money(selected.lead.est_value)} · PM: {selected.lead.pm_id ? "assigned" : "—"} · Location: {selected.lead.location || "—"}</p>
          <div className="row">
            {selected.lead.state === "NEW" && <button onClick={() => transition(selected.lead.id, "TRIAGED")}>Triage</button>}
            {selected.lead.state === "TRIAGED" && <button onClick={() => transition(selected.lead.id, "QUALIFYING")}>Start Qualifying</button>}
            {selected.lead.state === "QUALIFYING" && <><button onClick={() => transition(selected.lead.id, "QUALIFIED")}>Mark Qualified</button><button onClick={() => transition(selected.lead.id, "UNSERVICEABLE")}>N/A — Not a Fit</button></>}
            {selected.lead.state === "QUALIFIED" && <button onClick={() => transition(selected.lead.id, "READY_FOR_APPROVAL")}>Submit for Approval (gate-checked)</button>}
            {["PROPOSAL_SENT", "IN_FOLLOW_UP"].includes(selected.lead.state) && <><button onClick={() => transition(selected.lead.id, "WON")}>Mark Won → Project Handoff</button><button onClick={() => transition(selected.lead.id, "LOST", { lost_reason: "PRICE" })}>Mark Lost</button></>}
            {selected.lead.state === "PROPOSAL_DRAFTED" && <button onClick={() => transition(selected.lead.id, "PROPOSAL_SENT")}>Send Proposal</button>}
            {selected.lead.state === "APPROVED" && <button onClick={async () => { const pb = await api("/api/price-book"); await api(`/api/leads/${selected.lead.id}/proposals`, { method: "POST", body: { line_items: [{ price_book_item_id: pb[0].id, qty: 1 }] } }); await load(); openLead(selected.lead.id); }}>Generate Proposal (price book)</button>}
          </div>
          <h4>Timeline</h4>{selected.events.map((e: any) => <p key={e.id} className="evt">{e.type} {e.from_state || ""} → {e.to_state || ""} · {new Date(e.created_at).toLocaleString()}</p>)}
          <h4>Tasks</h4>{selected.tasks.map((t: any) => <p key={t.id} className="evt">{t.title} · due {new Date(t.due_at).toLocaleDateString()} · {t.status}</p>)}
        </div>}
      </>}
      {view === "approvals" && <><h1>Approval Inbox</h1>
        {approvals.length === 0 && <p>Nothing waiting. 🎉</p>}
        {approvals.map(a => <div className="card wide" key={a.id}><strong>{a.service_requested}</strong><span>{money(a.est_value)} · tier: {a.tier} · submitted {new Date(a.submitted_at).toLocaleString()}</span>
          <div className="row"><button onClick={async () => { await api(`/api/approvals/${a.id}/decide`, { method: "POST", body: { decision: "approved" } }); load(); }}>Approve</button>
          <button onClick={async () => { await api(`/api/approvals/${a.id}/decide`, { method: "POST", body: { decision: "rejected", reason_code: "PRICE" } }); load(); }}>Reject (Price)</button></div></div>)}
      </>}
      {view === "dashboard" && metrics && <><h1>Executive Dashboard</h1><div className="tiles">
        {[["First-Pass Approval Rate", metrics.first_pass_approval_rate !== null ? metrics.first_pass_approval_rate + "%" : "—"], ["Approval Cycle (median)", metrics.approval_cycle_median_hrs !== null ? metrics.approval_cycle_median_hrs + "h" : "—"], ["Win Rate", metrics.win_rate !== null ? metrics.win_rate + "%" : "—"], ["Open Pipeline", money(metrics.pipeline_open_value)], ["Backlog Remaining", metrics.backlog_remaining], ["Overdue Follow-ups", metrics.overdue_followups], ["No Next Step", metrics.leads_no_next_step], ["Field Report Compliance", metrics.field_report_compliance_pct !== null ? metrics.field_report_compliance_pct + "%" : "—"]].map(([k, v]) => <div className="tile" key={k as string}><span>{k}</span><strong>{v}</strong></div>)}
        </div>
        <h3>By Source</h3>{metrics.by_source.map((s: any) => <p key={s.source || "none"} className="evt">{s.source || "unknown"}: {s.leads} leads, {s.won} won</p>)}
        <h3>By Lead Owner</h3>{metrics.by_owner.map((s: any) => <p key={s.name || "none"} className="evt">{s.name || "unassigned"}: {s.active} leads, {s.won} won, {s.lost} lost</p>)}
      </>}
      {view === "demand" && <><h1>Demand Gap — Services You're Missing</h1>
        {demand.length === 0 && <p>No unmet-demand clusters yet. Mark leads N/A and they will appear here.</p>}
        {demand.map(d => <div className="card wide" key={d.service}><strong>{d.service}</strong><span>{d.lead_count} leads asked · est. {money(d.est_revenue)} ({d.est_basis})</span><span>Opportunity score {d.opportunity_score} → <strong>{d.recommendation}</strong></span></div>)}
      </>}
      {view === "handoffs" && <><h1>Handoff Monitor — Finals Delivered to Their System</h1>
        {handoffs.map(h => <div className="card wide" key={h.id}><strong>{h.outcome}</strong><span>Lead {h.lead_id.slice(0, 13)}… · status: {h.last_status} · attempts {h.attempts}{h.external_id ? ` · their ID: ${h.external_id}` : ""}</span></div>)}
      </>}
      {view === "ops" && ops && <><h1>Operations — Field Reports, Timesheets, Visits</h1>
        <h3>Field Reports</h3>{ops.field_reports.map((f: any) => <p key={f.id} className="evt">{f.manager} · {f.report_date} · {f.status}</p>)}
        <h3>Timesheets</h3>{ops.timesheets.map((t: any) => <p key={t.id} className="evt">{t.manager} · week of {t.week_of} · {t.status}{t.hours ? ` · ${t.hours}h` : ""}</p>)}
        <h3>Site Visits</h3>{ops.site_visits.length === 0 && <p className="evt">None scheduled.</p>}{ops.site_visits.map((v: any) => <p key={v.id} className="evt">{v.service_requested} · {new Date(v.scheduled_at).toLocaleString()} · {v.status}</p>)}
      </>}
    </main>
  </div>);
}
createRoot(document.getElementById("root")!).render(<App />);

import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

export const api = async (path: string, opts: any = {}) => {
  const r = await fetch(path, { method: opts.method || "GET", headers: { "Content-Type": "application/json" }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.code || j.error?.message || `HTTP ${r.status}`);
  return j;
};
export const money = (n: any) => "$" + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
export const num = (n: any) => Number(n || 0).toLocaleString();
export const dt = (s: any) => s ? new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
export const dOnly = (s: any) => s ? new Date(s).toLocaleDateString() : "—";
export const Badge = ({ s }: any) => <span className={`badge b-${s}`}>{String(s || "").replaceAll("_", " ")}</span>;
export const STATES = ["NEW", "TRIAGED", "QUALIFYING", "QUALIFIED", "READY_FOR_APPROVAL", "APPROVED", "PROPOSAL_DRAFTED", "PROPOSAL_SENT", "IN_FOLLOW_UP", "WON", "LOST", "NO_RESPONSE", "UNSERVICEABLE", "ON_HOLD", "JUNK", "DUPLICATE"];
export const BUCKETS: [string, string][] = [["new", "New"], ["working", "Working"], ["approver", "Waiting on Approver"], ["proposal", "Proposal Out"], ["won", "Won"], ["closed", "Closed"]];
type Nav = { view: string; leads?: any; leadId?: string };

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
    <div className="kpis">
      <K lab="Total leads" val={num(m.total_leads)} hint="All time · click to open Leads" onClick={() => go({ view: "leads" })} />
      <K lab="Won" val={num(m.won)} hint={`${money(d.won_value)} won value`} onClick={() => go({ view: "leads", leads: { bucket: "won" } })} />
      <K lab="Win rate" val={m.win_rate !== null ? m.win_rate + "%" : "—"} hint={`${num(m.won)} won · ${num(m.lost)} lost`} onClick={() => go({ view: "leads", leads: { bucket: "closed" } })} />
      <K lab="Open pipeline" val={money(m.pipeline_open_value)} hint="Qualified → proposal sent" onClick={() => go({ view: "leads", leads: { bucket: "proposal" } })} />
      <K lab="First-pass approval" val={m.first_pass_approval_rate !== null ? m.first_pass_approval_rate + "%" : "—"} hint={`${num(m.approvals_decided)} decided · median ${m.approval_cycle_median_hrs ?? "—"}h cycle`} onClick={() => go({ view: "approvals" })} />
      <K lab="Backlog remaining" val={num(m.backlog_remaining)} hint="New + triaged, unworked" onClick={() => go({ view: "leads", leads: { bucket: "new" } })} />
      <K lab="Overdue follow-ups" val={num(m.overdue_followups)} hint={`${num(m.leads_no_next_step)} leads with no next step`} onClick={() => go({ view: "leads", leads: { bucket: "working" } })} />
      <K lab="Avg won deal" val={money(d.avg_won_value)} hint={`First response median ${m.first_response_median_min ?? "—"} min`} onClick={() => go({ view: "leads", leads: { bucket: "won" } })} />
    </div>
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
  const [syncOpen, setSyncOpen] = useState(false);
  const [mode, setMode] = useState<"table" | "board">("table");
  const [f, setF] = useState<any>(initial || {});
  const [data, setData] = useState<any>({ items: [], total: 0, page: 1, pages: 1 });
  const [board, setBoard] = useState<Record<string, any>>({});
  const [tickFix, setTickFix] = useState(0);
  const load = () => { const qs = new URLSearchParams({ paged: "1", page: String(f.page || 1), page_size: "50", sort: f.sort || "recent" }); for (const k of ["state", "bucket", "q", "service", "owner_id", "overdue", "min_value", "unassigned"]) if (f[k]) qs.set(k, f[k]); api("/api/leads?" + qs).then(setData).catch(() => {}); };
  useEffect(load, [JSON.stringify(f), tickFix]);
  useEffect(() => { if (mode === "board") { const o: any = {}; Promise.all(BUCKETS.map(([b]) => api(`/api/leads?paged=1&bucket=${b}&page=1&page_size=25`).then(r => { o[b] = r; }))).then(() => setBoard({ ...o })); } }, [mode]);
  const Pager = () => <div className="pager"><span>{num(data.total)} leads · page {data.page} of {num(data.pages)}</span><button className="btn ghost small" disabled={data.page <= 1} onClick={() => setF({ ...f, page: data.page - 1 })}>← Prev</button><button className="btn ghost small" disabled={data.page >= data.pages} onClick={() => setF({ ...f, page: data.page + 1 })}>Next →</button></div>;
  return (<div>
    <h2 className="pt">Leads <button className="btn" style={{ float: "right" }} onClick={() => setSyncOpen(true)}>⇅ Sync leads</button></h2><p className="sub">Search, filter, sort — built for thousands of records. Click any row to open the full record.</p>
    {syncOpen && <SyncModal close={() => setSyncOpen(false)} done={() => setTickFix(t => t + 1)} />}
    <div className="rowflex">
      <div style={{ flex: 1, minWidth: 220 }}><input type="search" placeholder="Search name, phone, email, service, notes…" value={f.q || ""} onChange={e => setF({ ...f, q: e.target.value, page: 1 })} /></div>
      <select style={{ width: 180 }} value={f.sort || "recent"} onChange={e => setF({ ...f, sort: e.target.value })}><option value="recent">Newest first</option><option value="value">Highest value</option></select>
      <select style={{ width: 190 }} value={f.owner_id || ""} onChange={e => setF({ ...f, owner_id: e.target.value, page: 1 })}><option value="">All owners</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
      <div className="tabs" style={{ border: 0, margin: 0 }}><button className={mode === "table" ? "on" : ""} onClick={() => setMode("table")}>Table</button><button className={mode === "board" ? "on" : ""} onClick={() => setMode("board")}>Board</button></div>
    </div>
    <div className="chips">
      <span className="muted" style={{ alignSelf: "center", fontWeight: 700, fontSize: 12 }}>SAVED VIEWS:</span>
      <button className="chip" onClick={() => setF({ page: 1 })}>All leads</button>
      <button className="chip" onClick={() => setF({ page: 1, owner_id: me?.id })}>My leads</button>
      <button className="chip" onClick={() => setF({ page: 1, overdue: "1" })}>⏰ Overdue next steps</button>
      <button className="chip" onClick={() => setF({ page: 1, min_value: "10000", sort: "value" })}>💰 High value $10k+</button>
      <button className="chip" onClick={() => setF({ page: 1, unassigned: "1" })}>Unassigned</button>
    </div>
    <div className="chips">
      <button className={`chip ${!f.bucket && !f.state ? "on" : ""}`} onClick={() => setF({ ...f, bucket: "", state: "", page: 1 })}>All</button>
      {BUCKETS.map(([b, lab]) => <button key={b} className={`chip ${f.bucket === b ? "on" : ""}`} onClick={() => setF({ ...f, bucket: b, state: "", page: 1 })}>{lab}</button>)}
      <select style={{ width: 200 }} value={f.state || ""} onChange={e => setF({ ...f, state: e.target.value, bucket: "", page: 1 })}><option value="">Any exact state…</option>{STATES.map(s => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</select>
      {f.service && <button className="chip on" onClick={() => setF({ ...f, service: "" })}>Service: {f.service} ✕</button>}
    </div>
    {mode === "table" ? (<div className="card" style={{ padding: 6 }}><table><thead><tr><th>Contact</th><th>Service</th><th>AI Score</th><th>State</th><th>Value</th><th>Owner</th><th>Next step</th><th>Created</th></tr></thead><tbody>
      {data.items.map((l: any) => <tr className="clickable" key={l.id} onClick={() => openLead(l.id)}><td><b>{l.contact_name}</b><br /><span className="muted">{l.contact_phone || l.contact_email || ""}</span></td><td>{l.service_requested}</td><td>{l.ai_score !== null && l.ai_score !== undefined ? <span className={`score ${JSON.parse(l.ai_flags || "{}").temperature || "cold"}`}>{l.ai_score}</span> : <span className="muted">—</span>}</td><td><Badge s={l.state} /></td><td>{money(l.est_value)}</td><td>{l.owner_name || "—"}</td><td>{l.next_action || "—"}<br /><span className="muted">{dOnly(l.next_action_due_at)}</span></td><td>{dOnly(l.created_at)}</td></tr>)}
      {data.items.length === 0 && <tr><td colSpan={7} className="muted">No leads match these filters.</td></tr>}
    </tbody></table><Pager /></div>) : (
      <div className="kanban">{BUCKETS.map(([b, lab]) => <div className="kcol" key={b}><h4>{lab}<span>{num(board[b]?.total ?? 0)}</span></h4>
        {(board[b]?.items || []).map((l: any) => <div className="kcard" key={l.id} onClick={() => openLead(l.id)}><b>{l.service_requested}</b><span className="m">{l.contact_name} · {money(l.est_value)}<br />{l.state.replaceAll("_", " ")} · next {dOnly(l.next_action_due_at)}</span></div>)}
        {(board[b]?.total || 0) > 25 && <p className="muted" style={{ fontSize: 12 }}>+ {num(board[b].total - 25)} more — use Table view to page through all</p>}
      </div>)}</div>)}
  </div>);
}


function MessagesPanel({ lead }: any) {
  const [msgs, setMsgs] = useState<any[]>([]); const [ch, setCh] = useState("email"); const [subject, setSubject] = useState(""); const [body, setBody] = useState(""); const [note, setNote] = useState("");
  const [fups, setFups] = useState<any[]>([]);
  const loadF = () => { api(`/api/leads/${lead.id}/followups`).then(setFups).catch(() => {}); };
  useEffect(loadF, []);
  const load = () => { api(`/api/leads/${lead.id}/messages`).then(setMsgs).catch(() => {}); };
  useEffect(load, []);
  const send = async () => { const r = await api(`/api/leads/${lead.id}/message`, { method: "POST", body: { channel: ch, subject, body } }).catch((e: any) => ({ error: e.message })); if (r.error) { setNote("Not sent: " + r.error); return; } setNote(`Queued via ${ch} → status: ${r.status}${r.status === "test_mode" ? " (test mode — recorded in the outbox, not actually sent until provider keys are set)" : ""}`); setBody(""); setSubject(""); load(); };
  const activeFup = fups.find((f: any) => f.status === "active");
  return <div className="card"><h3 style={{ marginTop: 0 }}>Messages to {lead.contact_name || "customer"}</h3>
    {activeFup && <div className="ok" style={{ marginBottom: 10 }}>🔁 Automatic follow-ups running — step {(activeFup.step_idx || 0) + 1}, next nudge {dt(activeFup.next_due_at)}. Stops on signature or final outcome. <button className="btn ghost small" onClick={async () => { await api(`/api/leads/${lead.id}/followups/stop`, { method: "POST", body: {} }); loadF(); }}>Stop sequence</button></div>}
    <div className="chipRow"><button className={`chip ${ch === "email" ? "on" : ""}`} onClick={() => setCh("email")}>✉ Email {lead.contact_email || "(none on file)"}</button><button className={`chip ${ch === "sms" ? "on" : ""}`} onClick={() => setCh("sms")}>💬 SMS {lead.contact_phone || "(none)"}{lead.consent_contact_ok ? "" : " · no consent"}</button></div>
    {ch === "email" && <input placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} style={{ marginBottom: 8 }} />}
    <textarea placeholder={ch === "sms" ? "Text message…" : "Message…"} value={body} onChange={e => setBody(e.target.value)} rows={4} style={{ width: "100%" }} />
    <div className="rowflex" style={{ marginTop: 8 }}><button className="btn" disabled={!body.trim()} onClick={send}>Send {ch === "sms" ? "text" : "email"}</button>{note && <span className="muted">{note}</span>}</div>
    <h4 style={{ marginBottom: 6 }}>History</h4>
    {msgs.length === 0 && <p className="muted">Nothing sent yet.</p>}
    {msgs.map((m: any) => <p key={m.id} style={{ margin: "6px 0", borderBottom: "1px solid #eef2f7", paddingBottom: 6 }}><b>{m.channel === "sms" ? "💬" : "✉"} {m.to_addr}</b> · <span className="tinyBadge">{m.status}</span> <span className="muted">{dt(m.created_at)}</span>{m.subject ? <><br /><b>{m.subject}</b></> : ""}<br /><span className="muted">{m.body.slice(0, 220)}</span></p>)}
  </div>;
}

function LeadDetail({ id, users, priceBook, close, refresh }: any) {
  const [d, setD] = useState<any>(null); const [edit, setEdit] = useState<any>(null); const [msg, setMsg] = useState("");
  const [act, setAct] = useState<any>({ type: "call", body: "", outcome: "" });
  const [items, setItems] = useState<any[]>([]); const [check, setCheck] = useState<any>(null); const [tab, setTab] = useState("details");
  const load = () => { api("/api/leads/" + id).then(r => { setD(r); setEdit({ ...r.lead }); }).catch(e => setMsg(e.message)); };
  useEffect(load, [id]);
  if (!d) return <div className="modalWrap"><div className="modal">Loading… {msg}</div></div>;
  const l = d.lead;
  const PATH = ["NEW", "TRIAGED", "QUALIFYING", "QUALIFIED", "READY_FOR_APPROVAL", "APPROVED", "PROPOSAL_SENT", "WON"];
  const pathIdx = PATH.indexOf(l.state);
  const save = async () => { try { await api("/api/leads/" + id, { method: "PATCH", body: { service_requested: edit.service_requested, est_value: Number(edit.est_value) || 0, urgency: edit.urgency, owner_id: edit.owner_id, pm_id: edit.pm_id || null, approver_id: edit.approver_id || null, next_action: edit.next_action, notes: edit.notes, location: edit.location, contact: { name: edit.contact_name, phone: edit.contact_phone, email: edit.contact_email } } }); setMsg("Saved ✓"); load(); refresh && refresh(); } catch (e: any) { setMsg(e.message); } };
  const transit = async (to: string, extra: any = {}) => { try { const r = await api(`/api/leads/${id}/transition`, { method: "POST", body: { to_state: to, ...extra } }); if (r.error) setMsg(r.error); if (r.missing) setMsg("Gate blocked — missing: " + r.missing.join(", ")); setMsg(m => m || "Moved ✓"); load(); refresh && refresh(); } catch (e: any) { setMsg(e.message); } };
  const buildProposal = async () => { try { const clean = items.filter(i => i.price_book_item_id); if (!clean.length) return setMsg("Add at least one price-book line item"); await api(`/api/leads/${id}/proposals`, { method: "POST", body: { line_items: clean.map(i => ({ price_book_item_id: i.price_book_item_id, qty: Number(i.qty) || 1 })) } }); setMsg("Proposal drafted from price book ✓"); setItems([]); load(); } catch (e: any) { setMsg(e.message); } };
  return (<div className="modalWrap"><div className="modal">
    <div className="rowflex" style={{ justifyContent: "space-between" }}><h3 style={{ margin: 0 }}>{l.service_requested} — {l.contact_name}</h3><button className="btn ghost small" onClick={close}>✕ Close</button></div>
    <p className="muted" style={{ margin: "6px 0" }}>{l.contact_phone || ""} {l.contact_email ? "· " + l.contact_email : ""} · {l.location || ""} · created {dt(l.created_at)}</p>
    <div className="rowflex"><Badge s={l.state} /><b>{money(l.est_value)}</b><span className="muted">Owner: {l.owner_name || "—"} · PM: {l.pm_id ? "assigned" : "none"} · Next: {l.next_action || "—"} ({dOnly(l.next_action_due_at)})</span></div>
    {pathIdx >= 0 ? <div className="path">{PATH.map((st, i) => <div key={st} className={`stage ${i < pathIdx ? "done" : i === pathIdx ? "cur" : ""}`} title={st} onClick={() => { if (st !== l.state) transit(st); }}>{st.replaceAll("_", " ")}</div>)}</div>
      : <div className="pathFinal" style={{ background: "#fee2e2", color: "#991b1b" }}>Final state: {l.state.replaceAll("_", " ")}{l.lost_reason ? " · " + l.lost_reason : ""}</div>}
    <p className="muted" style={{ fontSize: 12, margin: "2px 0 6px" }}>Path — click a stage to move (the Completeness Gate still applies: nothing reaches approval incomplete).</p>
    {msg && <div className={msg.includes("✓") ? "ok" : "err"}>{msg}</div>}
    <div className="tabs"><button className={tab === "details" ? "on" : ""} onClick={() => setTab("details")}>Details</button><button className={tab === "activity" ? "on" : ""} onClick={() => setTab("activity")}>Activity & Tasks</button><button className={tab === "proposals" ? "on" : ""} onClick={() => setTab("proposals")}>Proposals & Files ({d.proposals.length})</button><button className={tab === "messages" ? "on" : ""} onClick={() => setTab("messages")}>Messages</button></div>
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
        <select style={{ width: 220 }} defaultValue="" onChange={e => { if (e.target.value) transit(e.target.value); e.target.value = ""; }}><option value="">Close as / move to…</option>{STATES.filter(s => s !== l.state).map(s => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</select>
        <button className="btn ghost" onClick={async () => setCheck(await api(`/api/leads/${id}/packet-check`, { method: "POST", body: {} }))}>Run completeness check</button></div>
      {check && <div className="card" style={{ marginTop: 12 }}><h3>Completeness Gate — {check.complete ? "✅ Ready for approval" : "⛔ Not ready"} · score {check.score}/100</h3>
        {["contact name", "contact phone or email", "service requested", "service location", "scope notes", "project manager", "proposal", "proposal line items from price book"].map((label: string) => { const okc = !(check.missing || []).includes(label); return <div className="check" key={label}><span className={`st ${okc ? "pass" : "fail"}`}>{okc ? "✓" : "✗"}</span><span>{label}{okc ? "" : " — missing"}</span></div>; })}
        {(check.flags || []).map((fl: string, i: number) => <p className="muted" key={i}>⚑ {fl}</p>)}</div>}
    </div>}
    {tab === "activity" && <div>
      <div className="card"><h3>Log contact (20 seconds)</h3>
        <div className="rowflex"><select style={{ width: 110 }} value={act.type} onChange={e => setAct({ ...act, type: e.target.value })}><option>call</option><option>text</option><option>email</option><option>visit</option></select><input style={{ flex: 1 }} placeholder="What happened?" value={act.body} onChange={e => setAct({ ...act, body: e.target.value })} /><button className="btn small" onClick={async () => { await api(`/api/leads/${id}/contact`, { method: "POST", body: act }); setAct({ type: "call", body: "", outcome: "" }); load(); }}>Log</button></div>
        <div className="feed" style={{ marginTop: 10 }}>{d.activities.map((a: any) => <div className="ev" key={a.id}><b>{a.type}</b> — {a.body} <span>· {a.user_name || ""} · {dt(a.created_at)}</span></div>)}{d.activities.length === 0 && <p className="muted">No activity logged yet.</p>}</div></div>
      <div className="card"><h3>Tasks ({d.tasks.filter((t: any) => t.status === "open").length} open)</h3>
        {d.tasks.map((t: any) => <div className="check" key={t.id}><span className={`st ${t.status === "done" ? "pass" : ""}`}>{t.status === "done" ? "✓" : "○"}</span><span style={{ flex: 1 }}>{t.title} <span className="muted">due {dOnly(t.due_at)}</span></span>{t.status === "open" && <button className="btn ghost small" onClick={async () => { await api(`/api/tasks/${t.id}/complete`, { method: "POST", body: {} }); load(); }}>Done</button>}</div>)}
        <div className="feed" style={{ marginTop: 12 }}><h3>Timeline</h3>{d.events.map((e: any) => <div className="ev" key={e.id}>{e.type.replaceAll("_", " ")}{e.to_state ? ` → ${e.to_state}` : ""} <span>· {dt(e.created_at)}</span></div>)}</div></div>
    </div>}
    {tab === "messages" && <MessagesPanel lead={d.lead} />}
    {tab === "proposals" && <div>
      <div className="card"><h3>Proposals</h3>
        {d.proposals.map((p: any) => <div key={p.id} style={{ borderBottom: "1px solid #eef2f7", padding: "8px 0" }}><b>v{p.version} · {money(p.total)}</b> · {p.status}{p.signed_at ? " · ✅ signed" : ""} · payment {p.payment_status || "—"}<br />
          <span className="rowflex" style={{ marginTop: 5 }}><button className="btn ghost small" onClick={async () => { const r = await api(`/api/proposals/${p.id}/sign-link`, { method: "POST", body: {} }); navigator.clipboard && navigator.clipboard.writeText(location.origin + "/sign/" + r.token); setMsg("Sign link copied: /sign/" + r.token); }}>Copy sign link</button>
          <button className="btn ghost small" onClick={async () => { const r = await api(`/api/proposals/${p.id}/deposit`, { method: "POST", body: {} }); setMsg(`Deposit link (${r.mode}): ${r.link}`); }}>Deposit link</button>
          <a className="btn ghost small" style={{ textDecoration: "none" }} href={`/api/proposals/${p.id}/docx`}>DOCX</a>
          <button className="btn ghost small" onClick={() => transit("PROPOSAL_SENT")}>Mark sent</button>
          <button className="btn small" onClick={async () => { const r = await api(`/api/proposals/${p.id}/send`, { method: "POST", body: { channel: "email" } }).catch((e: any) => ({ error: e.message })); setMsg(r.error ? "Send failed: " + r.error : `Proposal emailed to customer — delivery status: ${r.status}${r.status === "test_mode" ? " (test mode: recorded, not sent — add RESEND_API_KEY to go live)" : ""}`); load(); }}>✉ Send to customer</button>
          <button className="btn ghost small" onClick={async () => { const r = await api(`/api/proposals/${p.id}/send`, { method: "POST", body: { channel: "sms" } }).catch((e: any) => ({ error: e.message })); setMsg(r.error ? "SMS failed: " + r.error : `Proposal texted — status: ${r.status}`); load(); }}>💬 Text it</button></span></div>)}
        <label className="f">Build proposal — price book only</label>
        {items.map((it, i) => <div className="rowflex" key={i}><select style={{ flex: 2 }} value={it.price_book_item_id || ""} onChange={e => { const n = [...items]; n[i] = { ...n[i], price_book_item_id: e.target.value }; setItems(n); }}><option value="">Choose item…</option>{priceBook.map((pb: any) => <option key={pb.id} value={pb.id}>{pb.name} — {money(pb.standard_price)}</option>)}</select><input style={{ width: 70 }} type="number" value={it.qty || 1} onChange={e => { const n = [...items]; n[i] = { ...n[i], qty: e.target.value }; setItems(n); }} /><button className="btn ghost small" onClick={() => setItems(items.filter((_, x) => x !== i))}>✕</button></div>)}
        <div className="rowflex" style={{ marginTop: 8 }}><button className="btn ghost small" onClick={() => setItems([...items, { qty: 1 }])}>+ Line item</button><button className="btn small" onClick={buildProposal}>Draft proposal</button></div></div>
      <div className="card"><h3>Documents & visits</h3>
        {d.documents.map((doc: any) => <div className="check" key={doc.id}><span className={`st ${doc.status === "received" ? "pass" : "fail"}`}>{doc.status === "received" ? "✓" : "✗"}</span><span style={{ flex: 1 }}>{doc.name}</span>{doc.status !== "received" && <button className="btn ghost small" onClick={async () => { await api(`/api/documents/${doc.id}`, { method: "PATCH", body: { status: "received" } }); load(); }}>Mark received</button>}</div>)}
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
  const [res, setRes] = useState<any>(null); const [hist, setHist] = useState<any[]>([]); const [msg, setMsg] = useState("");
  const load = () => { api("/api/imports").then(setHist).catch(() => {}); };
  useEffect(load, []);
  const run = async () => { try { const r = await api("/api/imports/csv", { method: "POST", body: { csv, filename: "web-import.csv" } }); setRes(r); load(); } catch (e: any) { setMsg(e.message); } };
  const onFile = (f: File) => f.text().then(t => setCsv(t));
  return (<div><h2 className="pt">Import Leads</h2><p className="sub">Bring the backlog in — CSV from any source. Columns are auto-mapped (name, phone, email, service, value, location); duplicates are detected by phone/email and skipped, never double-created.</p>
    {msg && <div className="err">{msg}</div>}
    <div className="card"><h3>1 · Choose file or paste CSV</h3>
      <input type="file" accept=".csv" onChange={e => e.target.files && onFile(e.target.files[0])} />
      <textarea rows={9} style={{ marginTop: 10 }} value={csv} onChange={e => setCsv(e.target.value)} />
      <div className="rowflex" style={{ marginTop: 10 }}><button className="btn" onClick={run}>Import {csv.split("\n").filter(Boolean).length - 1 > 0 ? `(${csv.split("\n").filter(Boolean).length - 1} rows)` : ""}</button>
      {res && <span className="ok" style={{ margin: 0 }}>Created {res.created} · duplicates skipped {res.duplicates}</span>}</div>
      <p className="muted">Every imported lead lands owned, with a first-contact task and a 4-hour SLA — nothing enters unowned.</p></div>
    <div className="card"><h3>Import history</h3><table><thead><tr><th>File</th><th>When</th><th>Created</th><th>Duplicates</th><th>Status</th></tr></thead><tbody>
      {hist.map(h => { let t: any = {}; try { t = JSON.parse(h.totals || "{}"); } catch { t = {}; } return <tr key={h.id}><td>{h.filename}</td><td>{dt(h.created_at)}</td><td>{t.created ?? "—"}</td><td>{t.dupes ?? "—"}</td><td>{h.status}</td></tr>; })}
      {hist.length === 0 && <tr><td colSpan={5} className="muted">No imports yet.</td></tr>}</tbody></table></div>
  </div>);
}

function Demand() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api("/api/demand-gap").then(setRows).catch(() => {}); }, []);
  return (<div><h2 className="pt">Demand Gap</h2><p className="sub">Services customers keep asking for that you don't sell yet — clustered from lost & unserviceable leads. Estimates are labeled estimates, never presented as booked revenue.</p>
    {rows.map((r, i) => <div className="card" key={i}><div className="rowflex" style={{ justifyContent: "space-between" }}><b style={{ fontSize: 16 }}>{r.service}</b><span className="badge b-READY_FOR_APPROVAL">Opportunity score {r.opportunity_score}</span></div>
      <p className="muted">{num(r.lead_count)} leads asked · est. {money(r.estimated_monthly_value)}/mo (estimate) · trend {r.trend}</p>
      <p>{(r.sample_requests || []).slice(0, 3).join(" · ")}</p></div>)}
    {rows.length === 0 && <div className="card">No unmet-demand clusters yet — lost/N-A leads will surface them here.</div>}
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

function Ops() {
  const [d, setD] = useState<any>(null); const [inbox, setInbox] = useState<any[]>([]);
  const load = () => { api("/api/ops").then(setD).catch(() => {}); api("/api/inbox").then(setInbox).catch(() => {}); };
  useEffect(load, []);
  if (!d) return <p className="muted">Loading ops…</p>;
  const chase = async (kind: string, id: string) => { await api(`/api/${kind}/${id}/submit`, { method: "POST", body: {} }); load(); };
  return (<div><h2 className="pt">Ops Console</h2><p className="sub">The daily chase, in one place: field reports, timesheets, site visits, paperwork, and the full inbox (not just leads).</p>
    <div className="grid2">
      <div className="card"><h3>Field reports</h3><table><thead><tr><th>Manager</th><th>Date</th><th>Status</th><th></th></tr></thead><tbody>{d.field_reports.map((r: any) => <tr key={r.id}><td>{r.manager}</td><td>{r.report_date}</td><td>{r.status}</td><td>{r.status !== "submitted" && <button className="btn ghost small" onClick={() => chase("field-reports", r.id)}>Mark submitted</button>}</td></tr>)}</tbody></table></div>
      <div className="card"><h3>Timesheets</h3><table><thead><tr><th>Manager</th><th>Week of</th><th>Hours</th><th>Status</th><th></th></tr></thead><tbody>{d.timesheets.map((t: any) => <tr key={t.id}><td>{t.manager}</td><td>{t.week_of}</td><td>{t.hours ?? "—"}</td><td>{t.status}</td><td>{t.status !== "submitted" && <button className="btn ghost small" onClick={() => chase("timesheets", t.id)}>Mark submitted</button>}</td></tr>)}</tbody></table></div>
    </div>
    <div className="grid2">
      <div className="card"><h3>Site visits</h3>{d.site_visits.map((v: any) => <p key={v.id} style={{ margin: "6px 0" }}>📍 {v.service_requested} — {dt(v.scheduled_at)} · {v.status}</p>)}{d.site_visits.length === 0 && <p className="muted">None scheduled.</p>}</div>
      <div className="card"><h3>Documents tracker</h3>{d.documents.map((doc: any) => <div className="check" key={doc.id}><span className={`st ${doc.status === "received" ? "pass" : "fail"}`}>{doc.status === "received" ? "✓" : "✗"}</span><span>{doc.name} — {doc.status}{doc.required ? " (required)" : ""}</span></div>)}</div>
    </div>
    <div className="card"><h3>Inbox triage — everything, not just leads</h3><table><thead><tr><th>Category</th><th>From</th><th>Subject</th><th>Received</th></tr></thead><tbody>{inbox.map((i: any) => <tr key={i.id}><td><span className="badge b-TRIAGED">{i.category}</span></td><td>{i.from_name}</td><td>{i.subject}</td><td>{dt(i.received_at)}</td></tr>)}{inbox.length === 0 && <tr><td colSpan={4} className="muted">Inbox empty — connect Gmail/Outlook in Settings or ingest via API.</td></tr>}</tbody></table></div>
  </div>);
}

function Settings({ users, setUsers, priceBook, setPriceBook, onJump }: any) {
  const [tab, setTab] = useState("workspace");
  const [s, setS] = useState<any>(null); const [msg, setMsg] = useState("");
  const [tpls, setTpls] = useState<any[]>([]); const [svcs, setSvcs] = useState<any[]>([]);
  const [keys, setKeys] = useState<any[]>([]); const [newKey, setNewKey] = useState(""); const [hooks, setHooks] = useState<any[]>([]); const [flags, setFlags] = useState<any>({}); const [oauth, setOauth] = useState<any>(null); const [catalog, setCatalog] = useState<any[]>([]); const [cfg, setCfg] = useState<string | null>(null); const [cfgMsg, setCfgMsg] = useState(""); const [syncRange, setSyncRange] = useState("30");
  useEffect(() => { api("/api/integrations").then(r => setCatalog(r.integrations)).catch(() => {}); }, []);
  const [nb, setNb] = useState<any>({ name: "", unit: "job", standard_price: "", floor_price: "" });
  const [nt, setNt] = useState<any>({ name: "", body: "" }); const [nu, setNu] = useState<any>({ name: "", email: "", role: "LEAD_OWNER", password: "" }); const [nh, setNh] = useState("");
  const loadAll = () => { api("/api/settings").then(setS).catch(() => {}); api("/api/templates").then(setTpls).catch(() => {}); api("/api/services").then(setSvcs).catch(() => {}); api("/api/api-keys").then(setKeys).catch(() => {}); api("/api/webhooks").then(setHooks).catch(() => {}); api("/api/flags").then(setFlags).catch(() => {}); api("/api/oauth/status").then(setOauth).catch(() => {}); api("/api/users").then(setUsers).catch(() => {}); api("/api/price-book").then(setPriceBook).catch(() => {}); };
  useEffect(loadAll, []);
  const T = ({ id, children }: any) => <button className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{children}</button>;
  return (<div><h2 className="pt">Settings</h2><p className="sub">Everything configurable, in the product — no engineer required.</p>
    {msg && <div className="ok">{msg}</div>}
    <div className="tabs"><T id="workspace">Workspace</T><T id="pricebook">Price Book</T><T id="templates">Templates</T><T id="services">Services</T><T id="team">Team</T><T id="integrations">Integrations</T></div>
    {tab === "workspace" && s && <div className="card"><div className="formgrid">
      <div><label className="f">Business name</label><input value={s.workspace.name || ""} onChange={e => setS({ ...s, workspace: { ...s.workspace, name: e.target.value } })} /></div>
      <div><label className="f">Vertical</label><input value={s.workspace.vertical || ""} onChange={e => setS({ ...s, workspace: { ...s.workspace, vertical: e.target.value } })} /></div>
      <div><label className="f">Timezone</label><input value={s.workspace.timezone || ""} onChange={e => setS({ ...s, workspace: { ...s.workspace, timezone: e.target.value } })} /></div>
      <div><label className="f">Deposit % on signed proposals</label><input type="number" value={s.workspace.deposit_pct ?? 25} onChange={e => setS({ ...s, workspace: { ...s.workspace, deposit_pct: Number(e.target.value) } })} /></div>
      <div><label className="f">Autonomy level (1 draft-only · 2 bulk-approve · 3 scoped auto)</label><select value={s.workspace.autonomy_level ?? 1} onChange={e => setS({ ...s, workspace: { ...s.workspace, autonomy_level: Number(e.target.value) } })}><option value={1}>1 — draft only</option><option value={2}>2 — bulk approve</option><option value={3}>3 — scoped auto-approval</option></select></div>
      <div><label className="f">Counts</label><p className="muted">{num(s.counts.leads)} leads · {num(s.counts.users)} users · {num(s.counts.price_items)} price items</p></div>
      <div><label className="f">Lead source API URL (for Sync)</label><input value={s.workspace.source_api_url || ""} placeholder="Leave blank to use the built-in demo source" onChange={e => setS({ ...s, workspace: { ...s.workspace, source_api_url: e.target.value } })} /></div>
      <div><label className="f">Sender name (outgoing email)</label><input value={s.workspace.from_name || ""} placeholder="Your business name" onChange={e => setS({ ...s, workspace: { ...s.workspace, from_name: e.target.value } })} /></div>
      <div><label className="f">Sender email (outgoing email)</label><input value={s.workspace.from_email || ""} placeholder="you@yourbusiness.com" onChange={e => setS({ ...s, workspace: { ...s.workspace, from_email: e.target.value } })} /></div>
      <div><label className="f">Slack webhook URL (new-lead + approval alerts)</label><input value={s.workspace.slack_webhook_url || ""} placeholder="https://hooks.slack.com/services/…" onChange={e => setS({ ...s, workspace: { ...s.workspace, slack_webhook_url: e.target.value } })} /></div>
      <div><label className="f">Lead source API key (if required)</label><input value={s.workspace.source_api_key || ""} placeholder="Bearer key for your source system" onChange={e => setS({ ...s, workspace: { ...s.workspace, source_api_key: e.target.value } })} /></div>
    </div><button className="btn" style={{ marginTop: 14 }} onClick={async () => { await api("/api/settings", { method: "PATCH", body: s.workspace }); setMsg("Workspace settings saved ✓"); }}>Save workspace</button></div>}
    {tab === "workspace" && s && <FollowupSettings key={s.workspace.id} ws={s.workspace} />}
    {tab === "pricebook" && <div className="card"><table><thead><tr><th>Item</th><th>Unit</th><th>Standard</th><th>Floor</th><th></th></tr></thead><tbody>
      {priceBook.map((p: any) => <tr key={p.id}><td>{p.name}</td><td>{p.unit}</td><td>{money(p.standard_price)}</td><td>{money(p.floor_price)}</td><td><button className="btn ghost small" onClick={async () => { const v = prompt("New standard price ($)", p.standard_price); if (v) { await api(`/api/price-book/${p.id}`, { method: "PATCH", body: { standard_price: Number(v) } }); loadAll(); } }}>Edit price</button> <button className="btn ghost small" onClick={async () => { await api(`/api/price-book/${p.id}`, { method: "DELETE" }); loadAll(); }}>Delete</button></td></tr>)}
    </tbody></table>
      <div className="rowflex" style={{ marginTop: 12 }}><input style={{ flex: 2 }} placeholder="New item name" value={nb.name} onChange={e => setNb({ ...nb, name: e.target.value })} /><input style={{ width: 90 }} placeholder="unit" value={nb.unit} onChange={e => setNb({ ...nb, unit: e.target.value })} /><input style={{ width: 120 }} type="number" placeholder="standard $" value={nb.standard_price} onChange={e => setNb({ ...nb, standard_price: e.target.value })} /><input style={{ width: 120 }} type="number" placeholder="floor $" value={nb.floor_price} onChange={e => setNb({ ...nb, floor_price: e.target.value })} /><button className="btn" onClick={async () => { await api("/api/price-book", { method: "POST", body: { ...nb, standard_price: Number(nb.standard_price) || 0, floor_price: Number(nb.floor_price) || 0 } }); setNb({ name: "", unit: "job", standard_price: "", floor_price: "" }); loadAll(); }}>Add item</button></div>
      <p className="muted">Proposals can only price from this book — the floor is the margin guardrail the Approval Gate enforces.</p></div>}
    {tab === "templates" && <div className="card">{tpls.map(t => <div key={t.id} style={{ borderBottom: "1px solid #eef2f7", padding: "10px 0" }}><b>{t.name}</b> <span className="muted">· {t.kind} · v{t.version} · {t.active ? "active" : "inactive"}</span><p className="muted" style={{ whiteSpace: "pre-wrap" }}>{t.body}</p><button className="btn ghost small" onClick={async () => { const v = prompt("Edit template body", t.body); if (v !== null) { await api(`/api/templates/${t.id}`, { method: "PATCH", body: { body: v } }); loadAll(); } }}>Edit</button> <button className="btn ghost small" onClick={async () => { await api(`/api/templates/${t.id}`, { method: "DELETE" }); loadAll(); }}>Delete</button></div>)}
      <div className="formgrid" style={{ marginTop: 12 }}><div><label className="f">New template name</label><input value={nt.name} onChange={e => setNt({ ...nt, name: e.target.value })} /></div><div className="full"><label className="f">Body (merge fields: {"{{contact_name}} {{service}} {{total}}"})</label><textarea rows={4} value={nt.body} onChange={e => setNt({ ...nt, body: e.target.value })} /></div></div>
      <button className="btn" style={{ marginTop: 10 }} onClick={async () => { await api("/api/templates", { method: "POST", body: nt }); setNt({ name: "", body: "" }); loadAll(); }}>Add template</button></div>}
    {tab === "services" && <div className="card">{svcs.map(sv => <div className="check" key={sv.id}><span className={`st ${sv.active ? "pass" : "fail"}`}>{sv.active ? "✓" : "✗"}</span><span style={{ flex: 1 }}>{sv.name} {sv.is_catalog ? "" : "(not in catalog — Demand Gap territory)"}</span><button className="btn ghost small" onClick={async () => { await api(`/api/services/${sv.id}`, { method: "PATCH", body: { active: !sv.active } }); loadAll(); }}>{sv.active ? "Deactivate" : "Activate"}</button></div>)}
      <div className="rowflex" style={{ marginTop: 10 }}><input style={{ flex: 1 }} placeholder="New service name" id="nsvc" /><button className="btn" onClick={async () => { const el = document.getElementById("nsvc") as HTMLInputElement; await api("/api/services", { method: "POST", body: { name: el.value } }); el.value = ""; loadAll(); }}>Add service</button></div></div>}
    {tab === "team" && <div className="card"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Approval limit</th><th></th></tr></thead><tbody>
      {users.map((u: any) => <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td><select value={u.role} onChange={async e => { await api(`/api/users/${u.id}`, { method: "PATCH", body: { role: e.target.value } }); loadAll(); }}><option>OWNER</option><option>APPROVER</option><option>OPS_ADMIN</option><option>LEAD_OWNER</option><option>PM</option><option>ADMIN</option></select></td><td>{money(u.approval_limit)}</td><td></td></tr>)}
    </tbody></table>
      <div className="rowflex" style={{ marginTop: 12 }}><input style={{ flex: 1 }} placeholder="Name" value={nu.name} onChange={e => setNu({ ...nu, name: e.target.value })} /><input style={{ flex: 1 }} placeholder="Email" value={nu.email} onChange={e => setNu({ ...nu, email: e.target.value })} /><input style={{ flex: 1 }} placeholder="Temp password" value={nu.password} onChange={e => setNu({ ...nu, password: e.target.value })} /><select style={{ width: 150 }} value={nu.role} onChange={e => setNu({ ...nu, role: e.target.value })}><option>LEAD_OWNER</option><option>PM</option><option>APPROVER</option><option>OPS_ADMIN</option></select><button className="btn" onClick={async () => { await api("/api/users", { method: "POST", body: nu }); setNu({ name: "", email: "", role: "LEAD_OWNER", password: "" }); loadAll(); setMsg("Team member added ✓"); }}>Add member</button></div></div>}
    {tab === "integrations" && <div>
      <div className="card"><h3 style={{ marginTop: 0 }}>Integration catalog — every way data moves in and out</h3>
      <div className="featGrid">{catalog.map((c: any) => <div className="feat clickable" key={c.id} onClick={() => { setCfg(c.id); setCfgMsg(""); }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><b>{c.name}</b><span className="tinyBadge" style={c.status === "connected" ? { background: "#dcfce7", color: "#166534" } : c.status === "test_mode" || c.status === "demo_source" ? { background: "#fef9c3", color: "#854d0e" } : {}}>{c.status.replaceAll("_", " ")}</span></div><p>{c.detail}</p><span className="cfgHint">Configure →</span></div>)}</div></div>
      <div className="card"><h3>API keys</h3>{keys.map(k => <p key={k.id} className="muted" style={{ margin: "6px 0" }}>{k.label} · scopes {k.scopes} · {k.revoked_at ? "revoked" : "active"} {k.revoked_at ? "" : <button className="btn ghost small" onClick={async () => { await api(`/api/api-keys/${k.id}`, { method: "DELETE" }); loadAll(); }}>Revoke</button>}</p>)}
        <button className="btn" onClick={async () => { const r = await api("/api/api-keys", { method: "POST", body: { label: "Integration key" } }); setNewKey(r.key); loadAll(); }}>Generate new key</button>
        {newKey && <p className="mono ok">New key (shown once): {newKey}</p>}
        <p className="muted">Your system pulls finals from <span className="mono">GET /v1/outcomes</span> and acknowledges with <span className="mono">POST /v1/outcomes/:id/ack</span>. Push alternative: webhooks below.</p></div>
      <div className="card"><h3>Webhook endpoints (signed, HMAC)</h3>{hooks.map(h => <p key={h.id} className="muted" style={{ margin: "6px 0" }}><span className="mono">{h.url}</span> · {h.events} · {h.active ? "active" : "off"} <button className="btn ghost small" onClick={async () => { await api(`/api/webhooks/${h.id}`, { method: "DELETE" }); loadAll(); }}>Disable</button></p>)}
        <div className="rowflex"><input style={{ flex: 1 }} placeholder="https://your-system.example/webhooks/workpile" value={nh} onChange={e => setNh(e.target.value)} /><input style={{ flex: 1 }} placeholder="Events (comma list or *)" id="nhev" defaultValue="lead.created,lead.state_changed,approval.decided,proposal.signed,deposit.paid,outcome.final" /><button className="btn" onClick={async () => { await api("/api/webhooks", { method: "POST", body: { url: nh, events: (document.getElementById("nhev") as HTMLInputElement).value } }); setNh(""); loadAll(); }}>Add endpoint</button></div></div>
      <div className="card"><h3 style={{ marginTop: 0 }}>API quick reference — https://workpile.io</h3>
      <div className="tableWrap"><table><thead><tr><th>Method</th><th>Endpoint</th><th>What it does</th><th>Scope</th></tr></thead><tbody>
      {[["POST", "/v1/leads", "Create a lead — idempotent, deduped by phone/email", "leads:write"], ["GET", "/v1/leads", "List leads (filter by state)", "leads:read"], ["GET", "/v1/leads/:id", "Read one lead", "leads:read"], ["POST", "/v1/leads/:id/outcome", "Push a final outcome BACK into Workpile", "outcomes:write"], ["POST", "/v1/inbox", "Send an email/message for AI triage", "leads:write"], ["GET", "/v1/outcomes", "Pull final outcomes for your system", "outcomes:read"], ["POST", "/v1/outcomes/:id/ack", "Acknowledge with your system's ID", "outcomes:read"], ["GET", "/v1/projects/:leadId", "Won lead's full project package", "projects:read"]].map(r => <tr key={r[1] + r[0]}><td><b>{r[0]}</b></td><td><code>{r[1]}</code></td><td>{r[2]}</td><td>{r[3]}</td></tr>)}
      </tbody></table></div>
      <p className="muted">Full machine-readable spec: <a href="/openapi.json" target="_blank">workpile.io/openapi.json</a> · Webhooks are HMAC-signed (<code>X-Workpile-Signature</code>) and only marked delivered on a real 2xx from your endpoint. Zapier, Make, and n8n connect through this same API + webhooks today.</p></div>
      <div className="card"><h3>Inbox connections</h3><p className="muted">Gmail: {oauth?.google?.configured ? "app configured" : "not configured on this deployment"} · Outlook: {oauth?.microsoft?.configured ? "app configured" : "not configured"}. Manual/API/CSV ingestion works regardless.</p>
        <h3 style={{ marginTop: 16 }}>Feature flags (canary)</h3>{Object.entries(flags).map(([k, v]: any) => <div className="check" key={k}><span className={`st ${v ? "pass" : "fail"}`}>{v ? "✓" : "✗"}</span><span style={{ flex: 1 }}>{k.replaceAll("_", " ")}</span><button className="btn ghost small" onClick={async () => { await api("/api/flags", { method: "POST", body: { flag: k, enabled: !v } }); loadAll(); }}>{v ? "Turn off" : "Turn on"}</button></div>)}
        <h3 style={{ marginTop: 16 }}>Website form embed (captures TCPA consent automatically)</h3><p className="mono">&lt;script src="{location.origin}/embed/v1.js" data-workspace="YOUR_WORKSPACE" data-form="#lead-form"&gt;&lt;/script&gt;</p></div>
    </div>}
    {cfg && s && <IntegrationConfig id={cfg} s={s} setS={setS} keys={keys} hooks={hooks} oauth={oauth} loadAll={loadAll} onJump={onJump} msg={cfgMsg} setMsg={setCfgMsg} syncRange={syncRange} setSyncRange={setSyncRange} close={() => setCfg(null)} />}
  </div>);
}

function IntegrationConfig({ id, s, setS, keys, hooks, oauth, loadAll, onJump, msg, setMsg, syncRange, setSyncRange, close }: any) {
  if (!id) return null;
  const ws = s?.workspace || {};
  const saveSettings = async (patch: any) => { await api("/api/settings", { method: "PATCH", body: patch }); setMsg("Saved."); loadAll(); };
  const runSync = async (days: number) => { const to = new Date(); const from = new Date(Date.now() - days * 86400000); setMsg("Syncing…"); const r = await api("/api/sync/run", { method: "POST", body: { from: from.toISOString(), to: to.toISOString() } }); setMsg(`Sync done: ${r.fetched} fetched · ${r.created} created · ${r.duplicates} duplicates skipped.`); };
  const T: Record<string, string> = { rest_api: "REST API (two-way)", webhooks: "Event Webhooks", sync: "Lead Sync (pull)", csv: "CSV Import / Export", embed: "Website Form Embed", email_in: "Email-In API", gmail_outlook: "Gmail + Outlook", slack: "Slack Notifications", stripe: "Stripe", zapier_make: "Zapier / Make / n8n", handoff: "Final Outcome Handoff" };
  return <div className="modalOverlay" onClick={close}><div className="modal" onClick={e => e.stopPropagation()}>
    <div className="modalHead"><h3 style={{ margin: 0 }}>Configure — {T[id] || id}</h3><button className="btn ghost small" onClick={close}>✕</button></div>
    {msg && <p className="ok">{msg}</p>}
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

function Billing() {
  const [b, setB] = useState<any>(null);
  useEffect(() => { api("/api/billing").then(setB).catch(() => {}); }, []);
  if (!b) return <p className="muted">Loading billing…</p>;
  return (<div><h2 className="pt">Billing</h2><p className="sub">Your Workpile subscription — plan, trial, and live usage against your caps.</p>
    <div className="kpis">
      <div className="kpi"><div className="lab">Plan</div><div className="val">{b.plan.name}</div><div className="hint">{money(b.plan.price)}/mo</div></div>
      <div className="kpi"><div className="lab">Status</div><div className="val" style={{ fontSize: 20 }}>{b.subscription.status}</div><div className="hint">{b.trial_days_left !== null ? `${b.trial_days_left} trial days left` : "—"}</div></div>
      <div className="kpi"><div className="lab">Leads this month</div><div className="val">{num(b.usage.leads_this_month)}</div><div className="hint">of {num(b.usage.leads_limit)} ({b.usage.leads_pct}%)</div></div>
      <div className="kpi"><div className="lab">AI actions</div><div className="val">{num(b.usage.ai_actions_this_month)}</div><div className="hint">of {num(b.usage.ai_limit)}</div></div>
    </div>
    {b.usage.leads_pct >= 80 && <div className="err">You're at {b.usage.leads_pct}% of your monthly lead cap — ingestion pauses at 100%, approvals never do.</div>}
    <div className="card"><h3>Switch plan</h3><div className="rowflex">{Object.entries(b.plans).map(([k, p]: any) => <button className="btn ghost" key={k} onClick={async () => { const r = await api("/api/billing/checkout", { method: "POST", body: { plan: k } }); if (r.url) location.href = r.url; else alert(r.message || "Recorded — checkout opens when Stripe is configured."); }}>{p.name} · {money(p.price)}/mo</button>)}</div></div>
  </div>);
}

function Admin() {
  const [ws, setWs] = useState<any[]>([]); const [syn, setSyn] = useState<any>(null); const [dlq, setDlq] = useState<any[]>([]);
  useEffect(() => { api("/api/admin/workspaces").then(setWs).catch(() => {}); api("/api/admin/dlq").then(setDlq).catch(() => {}); }, []);
  return (<div><h2 className="pt">Platform Admin</h2><p className="sub">Operator view across every workspace on this deployment.</p>
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

function Reports() {
  const [ds, setDs] = useState("by_owner"); const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api("/api/reports?dataset=" + ds).then(r => setRows(r.rows)).catch(() => {}); }, [ds]);
  const tot = rows.reduce((a, r) => ({ leads: a.leads + (r.leads || 0), won: a.won + (r.won || 0), lost: a.lost + (r.lost || 0), value: a.value + (r.value || 0), won_value: a.won_value + (r.won_value || 0) }), { leads: 0, won: 0, lost: 0, value: 0, won_value: 0 });
  return (<div><h2 className="pt">Reports</h2><p className="sub">Tabular reports over your live data — the Salesforce Reports equivalent, without the report-builder maze. Export anything to CSV.</p>
    <div className="chips">{[["by_owner", "By owner"], ["by_service", "By service"], ["by_stage", "By stage"], ["by_source", "By source"], ["lost_reasons", "Lost reasons"]].map(([k, lab]) => <button key={k} className={`chip ${ds === k ? "on" : ""}`} onClick={() => setDs(k)}>{lab}</button>)}
      <a className="btn small" style={{ textDecoration: "none" }} href={`/api/reports/export?dataset=${ds}`}>⬇ Export CSV</a></div>
    <div className="card" style={{ padding: 6 }}><table><thead><tr><th>{ds.replaceAll("_", " ")}</th><th>Leads</th><th>Won</th><th>Lost</th>{ds === "by_source" && <th>Win rate</th>}<th>Pipeline value</th><th>Won value</th></tr></thead><tbody>
      {rows.map((r, i) => <tr key={i}><td><b>{r.label}</b></td><td>{num(r.leads)}</td><td>{num(r.won || 0)}</td><td>{num(r.lost || 0)}</td>{ds === "by_source" && <td>{r.leads ? Math.round(100 * (r.won || 0) / r.leads) + "%" : "—"}</td>}<td>{money(r.value)}</td><td>{money(r.won_value || 0)}</td></tr>)}
      <tr style={{ background: "#f8fafc" }}><td><b>Total</b></td><td><b>{num(tot.leads)}</b></td><td><b>{num(tot.won)}</b></td><td><b>{num(tot.lost)}</b></td>{ds === "by_source" && <td><b>{tot.leads ? Math.round(100 * tot.won / tot.leads) + "%" : "—"}</b></td>}<td><b>{money(tot.value)}</b></td><td><b>{money(tot.won_value)}</b></td></tr>
    </tbody></table></div></div>);
}

class EB extends React.Component<any, any> { state = { err: "" }; static getDerivedStateFromError(e: any) { return { err: String(e && e.message || e) }; } componentDidCatch(e: any, info: any) { console.error("EB-CATCH:", e.message, (info.componentStack || "").slice(0, 900)); } render() { return this.state.err ? <div className="err">Render error: {this.state.err}</div> : this.props.children; } }

function Logo({ light }: any) { return <span className="logo" style={light ? { color: "#fff" } : {}}><span className="mark">↗</span><span className="ltxt">Workpile</span></span>; }

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
  return (<div>
    <nav className="landNav"><Logo /><div className="links"><a href="#features">Features</a><a href="#how">How it works</a><a href="#compare">vs Salesforce</a><a href="#pricing">Pricing</a><button className="btn ghost" onClick={() => setMode("login")}>Sign in</button><button className="btn" onClick={() => setMode("register")}>Start free</button></div></nav>
    <div className="hero"><div>
      <h1>Your lead backlog, <em>cleared</em>. Your approvals, one tap. Your proposals, generated.</h1>
      <p className="lede">Workpile is the operations layer for owner-operated service businesses: it ingests leads from your website, inbox, spreadsheets, and systems — then triages, routes, prices, and follows up until every single one reaches a final outcome in your own platform.</p>
      <div className="rowflex"><button className="btn" style={{ padding: "13px 22px", fontSize: 15 }} onClick={() => setMode("register")}>Start 30-day free trial</button><button className="btn ghost" style={{ padding: "13px 22px", fontSize: 15 }} onClick={() => setMode("login")}>See the demo →</button></div>
      <p className="muted" style={{ marginTop: 12 }}>No card · Set up in minutes · Your data stays yours</p></div>
      <div className="heroMock"><div className="hm-kpis"><div className="hm"><span>Total leads</span><b>2,613</b></div><div className="hm"><span>Won</span><b>2,001</b></div><div className="hm"><span>First-pass approval</span><b>100%</b></div></div>
        <div className="hm-row"><span>✅ Packet approved — Water damage, $4,550</span><b>10s</b></div>
        <div className="hm-row"><span>🔥 17 hot leads scored 70+ today</span><b>AI</b></div>
        <div className="hm-row"><span>🔁 Won → project GC-JOB-1042 acknowledged</span><b>✓</b></div>
        <div className="hm-row"><span>🧹 23 duplicates archived by AI cleanup</span><b>✓</b></div></div></div>
    <div className="section" id="features"><h2>Everything between "new lead" and "final outcome"</h2><p className="sub2">Salesforce tracks your pipeline. Workpile finishes it — with the approval discipline, pricing guardrails, and handoff plumbing a working business actually needs.</p>
      <div className="featGrid">{FEATS.map(([ic, t, d]) => <div className="feat" key={t}><div className="ic">{ic}</div><h4>{t}</h4><p>{d}</p></div>)}</div></div>
    <div className="section" id="how"><h2>How it works</h2><div className="steps">
      <div className="step"><b>1</b><h4>Connect & clear</h4><p>Sync from your lead system by date range, upload the CSV pile, connect your inbox and website form. AI cleans, dedupes, scores, and assigns everything.</p></div>
      <div className="step"><b>2</b><h4>Approve & propose</h4><p>Your team works leads on a Salesforce-style Path. Complete packets land in your Approval Inbox; proposals generate from your price book, get e-signed, and collect the deposit.</p></div>
      <div className="step"><b>3</b><h4>Hand off & learn</h4><p>Every final — won, lost, no-response, N/A — is delivered into your own platform with acknowledgment tracking, while Demand Gap shows you what to sell next.</p></div></div></div>
    <div className="section" id="compare"><h2>Why teams switch from Salesforce</h2><p className="sub2">Salesforce is a database you configure for six months. Workpile is the workflow, finished — at a tenth of the seat cost.</p>
      <div className="tableWrap"><table className="cmp"><thead><tr><th></th><th>Workpile</th><th>Salesforce</th></tr></thead><tbody>
        {[["Backlog clearing & AI triage built in", 1, 0], ["Completeness Gate before approvals", 1, 0], ["Proposals generated from your price book", 1, 0], ["Final outcomes delivered into your other systems", 1, 0], ["Pipeline, Path, reports & dashboards", 1, 1], ["Live in an afternoon, no admin required", 1, 0], ["Flat per-business pricing from $299/mo", 1, 0]].map(([t, a, b]: any) => <tr key={t}><td>{t}</td><td className={a ? "yes" : "no"}>{a ? "✓ Included" : "—"}</td><td className={b ? "yes" : "no"}>{b ? "✓" : "Add-on / custom build"}</td></tr>)}
      </tbody></table></div></div>
    <div className="section" id="pricing"><h2>Pricing — 30 days free, no card</h2><div className="featGrid">
      {[["Starter", "$299/mo", "500 leads/mo · 5 seats · backlog clear, approvals, proposals, handoff"], ["Growth", "$599/mo", "2,000 leads/mo · 15 seats · + AI operations, demand gap, customer portal"], ["Pro", "$999/mo", "Unlimited leads · 30 seats · + priority support, advanced reports"]].map(([n, p, d]) => <div className="feat" key={n}><span className="muted" style={{ textTransform: "uppercase", fontWeight: 700, fontSize: 12 }}>{n}</span><h4 style={{ fontSize: 24 }}>{p}</h4><p>{d}</p><button className="btn" style={{ marginTop: 12 }} onClick={() => setMode("register")}>Start free</button></div>)}</div></div>
    <div className="section"><h2>Questions</h2>
      {[["Do I have to replace my current system?", "No — Workpile is the front door, not the house. Won jobs become projects in YOUR platform via API or webhooks; every final outcome is delivered and acknowledged there."], ["How do leads get in?", "Four ways: sync from your lead system's API by date range (daily auto-sync available), CSV upload, website form embed with TCPA consent, and inbox/API ingestion."], ["Is the AI allowed to send things on its own?", "Never. Agents draft, score, and organize; every customer-facing send and every price-bearing decision needs a human approval. That's a product invariant, not a setting."], ["What happens to duplicates?", "Ingestion dedupes by phone/email automatically. AI Cleanup finds the rest — same name + service — and archives them as duplicates of the original, with the merge recorded."]].map(([q, a]) => <div className="faq" key={q}><b>{q}</b><p>{a}</p></div>)}</div>
    <footer className="landFoot"><Logo /><span>© 2026 Workpile · workpile.io · <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · <a href="/dpa">DPA</a></span><span>Built for the businesses that answer the phone.</span></footer>
  </div>);
}

function AIAssistant({ go }: any) {
  const [ins, setIns] = useState<any[]>([]); const [prev, setPrev] = useState<any>(null); const [acts, setActs] = useState<any>({ dedupe: true, spam: true, score: true, assign: false });
  const [result, setResult] = useState<any>(null); const [msg, setMsg] = useState("");
  useEffect(() => { api("/api/ai/insights").then(setIns).catch(() => {}); }, []);
  const scan = async () => { setPrev(await api("/api/ai/cleanup/preview", { method: "POST", body: {} })); setResult(null); };
  const apply = async () => { const chosen = Object.entries(acts).filter(([, v]) => v).map(([k]) => k); const r = await api("/api/ai/cleanup/apply", { method: "POST", body: { actions: chosen } }); setResult(r); setPrev(null); api("/api/ai/insights").then(setIns).catch(() => {}); };
  return (<div><h2 className="pt">AI Assistant</h2><p className="sub">Agents do the chasing, sorting, and scoring — nothing customer-facing ever sends without your approval. Every action here is preview first, apply second.</p>
    {msg && <div className="ok">{msg}</div>}
    <div className="card"><h3>Insights — what needs you today</h3>
      {ins.map((i: any, k: number) => <div className="insight" key={k}><div className="ic">{i.icon}</div><div style={{ flex: 1 }}><b>{i.title}</b><p>{i.detail}</p></div>{i.kind === "stale" && <button className="btn ghost small" onClick={async () => { const r = await api("/api/ai/reactivate", { method: "POST", body: {} }); setMsg(`Reactivation tasks created: ${r.tasks_created} ✓`); }}>Create tasks</button>}{i.kind === "hot" && <button className="btn ghost small" onClick={() => go({ view: "leads", leads: { sort: "value" } })}>View leads</button>}</div>)}
      {ins.length === 0 && <p className="muted">All clear — no duplicates, no unassigned leads, nothing stale. The AI is watching.</p>}</div>
    <div className="card"><h3>AI Cleanup — duplicates, spam, scoring, assignment</h3>
      {!prev && !result && <button className="btn" onClick={scan}>Run cleanup scan</button>}
      {prev && <div><p><b>{prev.duplicate_count}</b> duplicates · <b>{prev.spam_count}</b> spam/invalid · <b>{prev.unassigned_count}</b> unassigned · <b>{prev.unscored_count}</b> unscored — of {num(prev.total_leads)} leads</p>
        {prev.duplicates.slice(0, 6).map((d: any) => <p className="muted" key={d.id} style={{ margin: "3px 0" }}>Duplicate: {d.name} — {d.service} (original kept)</p>)}
        {prev.spam.slice(0, 4).map((d: any) => <p className="muted" key={d.id} style={{ margin: "3px 0" }}>Spam/invalid: {d.name || "—"} — {d.service}</p>)}
        <div style={{ margin: "12px 0" }}>{[["dedupe", "Archive duplicates (original kept, merge recorded)"], ["spam", "Mark spam/invalid as Junk"], ["score", "Score every lead (hot / warm / cold)"], ["assign", "Auto-assign unassigned leads round-robin"]].map(([k, lab]) => <label className="check" key={k}><input type="checkbox" style={{ width: "auto" }} checked={acts[k]} onChange={e => setActs({ ...acts, [k]: e.target.checked })} /><span>{lab}</span></label>)}</div>
        <div className="rowflex"><button className="btn" onClick={apply}>Apply cleanup</button><button className="btn ghost" onClick={() => setPrev(null)}>Cancel</button></div></div>}
      {result && <div className="ok">Cleanup applied ✓ — {result.archived_duplicates} duplicates archived · {result.marked_spam} spam marked · {result.scored} leads scored · {result.assigned} auto-assigned. <button className="btn ghost small" onClick={scan}>Scan again</button></div>}
    </div>
    <div className="card"><h3>How the agents work</h3><p className="muted" style={{ lineHeight: 1.6 }}>Triage classifies every incoming lead (service, urgency, value band, spam) the second it lands. Scoring ranks the pile so humans call hot leads first. Cleanup keeps the data honest. The Completeness Gate is the bouncer: no packet reaches an approver missing contact, scope, visit, PM, or price-book pricing. Agents never invent prices and never send anything customer-facing — that line is enforced in code, not policy.</p></div>
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
  useEffect(() => { if (!q.trim()) { setLeads([]); return; } const t = setTimeout(() => { api(`/api/leads?paged=1&page=1&page_size=6&q=${encodeURIComponent(q)}`).then(r => setLeads(r.items || [])).catch(() => {}); }, 160); return () => clearTimeout(t); }, [q]);
  const acts = ACTIONS.filter(a => a.label.toLowerCase().includes(q.toLowerCase()));
  const items: any[] = [...(q ? [] : recents.map((l: any) => ({ label: `${l.contact_name || "Lead"} — ${l.service_requested || ""}`, sub: "Recent", run: () => openLead(l.id) }))), ...acts.map(a => ({ ...a, sub: "Go / do" })), ...leads.map((l: any) => ({ label: `${l.contact_name || "Lead"} — ${l.service_requested || ""}`, sub: l.state, run: () => openLead(l.id) }))];
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

function App() {
  const [user, setUser] = useState<any>(null); const [login, setLogin] = useState({ email: "", password: "" }); const [err, setErr] = useState("");
  const [nav, setNav] = useState<Nav>({ view: "dashboard" }); const [users, setUsers] = useState<any[]>([]); const [priceBook, setPriceBook] = useState<any[]>([]);
const [sb, setSb] = useState(() => localStorage.getItem("wp_sb") || "open"); const [mOpen, setMOpen] = useState(false);
  const [notifs, setNotifs] = useState<any[]>([]); const [unread, setUnread] = useState(0); const [bellOpen, setBellOpen] = useState(false); const [verifyMsg, setVerifyMsg] = useState("");
const [pending, setPending] = useState(0); const [creating, setCreating] = useState(false); const [leadId, setLeadId] = useState<string | null>(null); const [tick, setTick] = useState(0);
  const [palOpen, setPalOpen] = useState(false); const [helpOpen, setHelpOpen] = useState(false);
  const openLead = (id: string) => { setLeadId(id); try { const r = JSON.parse(localStorage.getItem("wp_recent") || "[]").filter((x: string) => x !== id); r.unshift(id); localStorage.setItem("wp_recent", JSON.stringify(r.slice(0, 6))); } catch {} };
  useEffect(() => { if (!user) return; let gAt = 0;
    const h = (e: KeyboardEvent) => { const t = e.target as HTMLElement; const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalOpen(o => !o); return; }
      if (typing || palOpen) return;
      if (e.key === "Escape") { setHelpOpen(false); return; }
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) { setHelpOpen(o => !o); return; }
      if (e.key === "/") { e.preventDefault(); setPalOpen(true); return; }
      if (e.key.toLowerCase() === "n") { setCreating(true); return; }
      if (e.key.toLowerCase() === "g") { gAt = Date.now(); return; }
      if (gAt && Date.now() - gAt < 900) { const m: Record<string, string> = { d: "dashboard", p: "pulse", l: "leads", a: "approvals", r: "reports", s: "settings", b: "billing" }; const v = m[e.key.toLowerCase()]; if (v) { setNav({ view: v }); gAt = 0; } }
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [user, palOpen]);
  const [workspaces, setWorkspaces] = useState<any[]>([]); const [newWs, setNewWs] = useState("");
  useEffect(() => { if (user) api("/api/workspaces").then(r => setWorkspaces(r.workspaces || [])).catch(() => {}); }, [user?.id]);
  useEffect(() => { api("/api/auth/me").then(r => { setUser(r.user); setWorkspaces(r.workspaces || []); }).catch(() => {}); }, []);
  useEffect(() => { if (user) api("/api/notifications").then(r => { setNotifs(r.notifications); setUnread(r.unread); }).catch(() => {}); }, [user, tick]);
  useEffect(() => { if (user) { api("/api/users").then(setUsers).catch(() => {}); api("/api/price-book").then(setPriceBook).catch(() => {}); api("/api/approvals").then(r => setPending(r.length)).catch(() => {}); } }, [user, tick]);
  if (!user) return <Landing onAuth={(u: any) => { setUser(u); }} />;
  const go = (n: Nav) => setNav(n);
  const NavB = ({ v, children, cnt, short }: any) => <button className={nav.view === v ? "on" : ""} title={children} onClick={() => { go({ view: v }); setMOpen(false); }}><span className="nshort">{short}</span><span className="nlab">{children}</span>{cnt ? <span className="cnt">{cnt}</span> : null}</button>;
  const toggleSb = () => { const next = sb === "rail" ? "open" : "rail"; setSb(next); localStorage.setItem("wp_sb", next); };
  return (<div className="layout">
    {mOpen && <div className="scrim" onClick={() => setMOpen(false)} />}
    <aside className={`side ${sb === "rail" ? "rail" : ""} ${mOpen ? "mOpen" : ""}`}><div className="sideHead"><Logo /><button className="collapseBtn" title={sb === "rail" ? "Expand sidebar" : "Collapse sidebar"} onClick={toggleSb}>{sb === "rail" ? "»" : "«"}</button></div><div className="who">{user.name} · {user.role}</div>
      <select className="wsSwitch" value={user.workspace_id} onChange={async e => { if (e.target.value === "__new") { const name = prompt("New business / workspace name"); if (name) { await api("/api/workspaces", { method: "POST", body: { name } }); location.reload(); } return; } await api("/api/workspaces/switch", { method: "POST", body: { workspace_id: e.target.value } }); location.reload(); }}>
        {workspaces.map((w: any) => <option key={w.workspace_id} value={w.workspace_id}>{w.name} ({w.role})</option>)}
        <option value="__new">+ New workspace…</option></select>
      <NavB v="dashboard" short="DA">Dashboard</NavB><NavB v="pulse" short="PU">Pulse</NavB><NavB v="leads" short="LE">Leads</NavB><NavB v="reports" short="RE">Reports</NavB><NavB v="approvals" short="AP" cnt={pending || undefined}>Approvals</NavB><NavB v="ai" short="AI">AI Assistant</NavB><NavB v="imports" short="IM">Import CSV</NavB><NavB v="demand" short="DG">Demand Gap</NavB><NavB v="handoffs" short="HA">Handoffs</NavB><NavB v="ops" short="OP">Ops Console</NavB><NavB v="settings" short="SE">Settings</NavB><NavB v="billing" short="BI">Billing</NavB>
      {user.is_platform_admin ? <NavB v="admin" short="AD">Platform Admin</NavB> : null}
      <div className="sideFoot"><button title="Sign out" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }).catch(() => {}); setUser(null); }}><span className="nshort">⏻</span><span className="nlab">Sign out</span></button></div>
    </aside>
    <main>
      <div className="topbar"><button className="btn ghost burger" onClick={() => setMOpen(o => !o)}>☰</button><div className="search"><input type="search" readOnly placeholder="Search leads, jump anywhere…  ( ⌘K )" onFocus={() => setPalOpen(true)} /></div>
        <div style={{ position: "relative" }}><button className="btn ghost" onClick={() => setBellOpen(o => !o)}>🔔{unread ? <span className="cnt" style={{ background: "#dc2626", color: "#fff", borderRadius: 99, fontSize: 11, padding: "1px 7px", fontWeight: 700, marginLeft: 4 }}>{unread}</span> : null}</button>
        {bellOpen && <div className="bellPanel"><div className="rowflex" style={{ justifyContent: "space-between" }}><b>Notifications</b><button className="btn ghost small" onClick={async () => { await api("/api/notifications/read-all", { method: "POST", body: {} }); setUnread(0); setNotifs(notifs.map(n => ({ ...n, read_at: n.read_at || "now" }))); }}>Mark all read</button></div>
        {notifs.length === 0 && <p className="muted">Nothing yet \u2014 approvals, signatures, deposits, and new leads land here.</p>}
        {notifs.map(n => <div key={n.id} className="bellItem" style={n.read_at ? {} : { background: "#f0f9f1" }} onClick={async () => { await api(`/api/notifications/${n.id}/read`, { method: "POST", body: {} }); setUnread(u => Math.max(0, u - (n.read_at ? 0 : 1))); if (n.lead_id) { openLead(n.lead_id); setBellOpen(false); } }}><b>{n.title}</b><br /><span className="muted">{n.body}</span><br /><span className="muted" style={{ fontSize: 11.5 }}>{dt(n.created_at)}</span></div>)}</div>}</div>
        <button className="btn" onClick={() => setCreating(true)}>+ New Lead</button></div>
      {user && user.email_verified === 0 && <div className="verifyBar">✉️ Verify your email to secure your account and enable password recovery. <button className="btn ghost small" onClick={async () => { const r = await api("/api/auth/resend-verify", { method: "POST", body: {} }).catch((e: any) => ({ error: e.message })); setVerifyMsg(r.verify_url ? "Test mode \u2014 verify here: " + r.verify_url : r.error ? r.error : "Verification email sent \u2014 check your inbox."); }}>Resend verification</button>{verifyMsg && <span style={{ marginLeft: 8 }}>{verifyMsg}</span>}</div>}
      <EB>
      {nav.view === "dashboard" && <Dashboard go={go} openLead={openLead} />}
      {nav.view === "pulse" && <Pulse openLead={openLead} />}
      {nav.view === "leads" && <Leads key={JSON.stringify(nav.leads || {}) + tick} initial={nav.leads} openLead={openLead} users={users} me={user} />}
      {nav.view === "reports" && <Reports />}
      {nav.view === "approvals" && <Approvals openLead={openLead} />}
      {nav.view === "ai" && <AIAssistant go={go} />}
      {nav.view === "imports" && <Imports />}
      {nav.view === "demand" && <Demand />}
      {nav.view === "handoffs" && <Handoffs />}
      {nav.view === "ops" && <Ops />}
      {nav.view === "settings" && <Settings users={users} setUsers={setUsers} priceBook={priceBook} setPriceBook={setPriceBook} onJump={(v: string) => go({ view: v as any })} />}
      {nav.view === "billing" && <Billing />}
      {nav.view === "admin" && <Admin />}
      </EB>
      {creating && <CreateLead users={users} done={(id: any) => { setCreating(false); setTick(t => t + 1); if (id) openLead(id); }} />}
      {palOpen && <CommandPalette close={() => setPalOpen(false)} go={go} openLead={openLead} newLead={() => setCreating(true)} />}
      {helpOpen && <div className="modalWrap" onClick={() => setHelpOpen(false)}><div className="card" style={{ maxWidth: 430, margin: "10vh auto" }} onClick={e => e.stopPropagation()}><h3 style={{ marginTop: 0 }}>Keyboard shortcuts</h3><table><tbody>{[["⌘K or /", "Command palette — search + jump"], ["N", "New lead"], ["G then D / P / L / A / R / S / B", "Go to Dashboard / Pulse / Leads / Approvals / Reports / Settings / Billing"], ["?", "This help"], ["Esc", "Close dialogs"]].map(([k, v]) => <tr key={k}><td style={{ whiteSpace: "nowrap" }}><span className="kbd">{k}</span></td><td>{v}</td></tr>)}</tbody></table></div></div>}
      {leadId && <LeadDetail id={leadId} users={users} priceBook={priceBook} close={() => setLeadId(null)} refresh={() => setTick(t => t + 1)} />}
    </main>
  </div>);
}
createRoot(document.getElementById("root")!).render(<App />);

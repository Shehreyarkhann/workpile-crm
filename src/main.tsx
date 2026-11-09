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
  const [d, setD] = useState<any>(null);
  useEffect(() => { api("/api/dashboard").then(setD).catch(() => {}); }, []);
  if (!d) return <p className="muted">Loading dashboard…</p>;
  const m = d.metrics;
  const maxF = Math.max(1, ...d.funnel.map((f: any) => f.count));
  const maxS = Math.max(1, ...d.series.map((s: any) => s.created + s.won));
  const K = ({ lab, val, hint, onClick, cls }: any) => <div className="kpi" onClick={onClick}><div className="lab">{lab}</div><div className="val">{val}</div><div className="hint">{hint}</div></div>;
  return (<div>
    <h2 className="pt">Dashboard</h2><p className="sub">Every number is live and clickable — drill straight into the records behind it.</p>
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
  const [mode, setMode] = useState<"table" | "board">("table");
  const [f, setF] = useState<any>(initial || {});
  const [data, setData] = useState<any>({ items: [], total: 0, page: 1, pages: 1 });
  const [board, setBoard] = useState<Record<string, any>>({});
  const load = () => { const qs = new URLSearchParams({ paged: "1", page: String(f.page || 1), page_size: "50", sort: f.sort || "recent" }); for (const k of ["state", "bucket", "q", "service", "owner_id", "overdue", "min_value", "unassigned"]) if (f[k]) qs.set(k, f[k]); api("/api/leads?" + qs).then(setData).catch(() => {}); };
  useEffect(load, [JSON.stringify(f)]);
  useEffect(() => { if (mode === "board") { const o: any = {}; Promise.all(BUCKETS.map(([b]) => api(`/api/leads?paged=1&bucket=${b}&page=1&page_size=25`).then(r => { o[b] = r; }))).then(() => setBoard({ ...o })); } }, [mode]);
  const Pager = () => <div className="pager"><span>{num(data.total)} leads · page {data.page} of {num(data.pages)}</span><button className="btn ghost small" disabled={data.page <= 1} onClick={() => setF({ ...f, page: data.page - 1 })}>← Prev</button><button className="btn ghost small" disabled={data.page >= data.pages} onClick={() => setF({ ...f, page: data.page + 1 })}>Next →</button></div>;
  return (<div>
    <h2 className="pt">Leads</h2><p className="sub">Search, filter, sort — built for thousands of records. Click any row to open the full record.</p>
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
    {mode === "table" ? (<div className="card" style={{ padding: 6 }}><table><thead><tr><th>Contact</th><th>Service</th><th>State</th><th>Value</th><th>Owner</th><th>Next step</th><th>Created</th></tr></thead><tbody>
      {data.items.map((l: any) => <tr className="clickable" key={l.id} onClick={() => openLead(l.id)}><td><b>{l.contact_name}</b><br /><span className="muted">{l.contact_phone || l.contact_email || ""}</span></td><td>{l.service_requested}</td><td><Badge s={l.state} /></td><td>{money(l.est_value)}</td><td>{l.owner_name || "—"}</td><td>{l.next_action || "—"}<br /><span className="muted">{dOnly(l.next_action_due_at)}</span></td><td>{dOnly(l.created_at)}</td></tr>)}
      {data.items.length === 0 && <tr><td colSpan={7} className="muted">No leads match these filters.</td></tr>}
    </tbody></table><Pager /></div>) : (
      <div className="kanban">{BUCKETS.map(([b, lab]) => <div className="kcol" key={b}><h4>{lab}<span>{num(board[b]?.total ?? 0)}</span></h4>
        {(board[b]?.items || []).map((l: any) => <div className="kcard" key={l.id} onClick={() => openLead(l.id)}><b>{l.service_requested}</b><span className="m">{l.contact_name} · {money(l.est_value)}<br />{l.state.replaceAll("_", " ")} · next {dOnly(l.next_action_due_at)}</span></div>)}
        {(board[b]?.total || 0) > 25 && <p className="muted" style={{ fontSize: 12 }}>+ {num(board[b].total - 25)} more — use Table view to page through all</p>}
      </div>)}</div>)}
  </div>);
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
    <div className="tabs"><button className={tab === "details" ? "on" : ""} onClick={() => setTab("details")}>Details</button><button className={tab === "activity" ? "on" : ""} onClick={() => setTab("activity")}>Activity & Tasks</button><button className={tab === "proposals" ? "on" : ""} onClick={() => setTab("proposals")}>Proposals & Files ({d.proposals.length})</button></div>
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
    {tab === "proposals" && <div>
      <div className="card"><h3>Proposals</h3>
        {d.proposals.map((p: any) => <div key={p.id} style={{ borderBottom: "1px solid #eef2f7", padding: "8px 0" }}><b>v{p.version} · {money(p.total)}</b> · {p.status}{p.signed_at ? " · ✅ signed" : ""} · payment {p.payment_status || "—"}<br />
          <span className="rowflex" style={{ marginTop: 5 }}><button className="btn ghost small" onClick={async () => { const r = await api(`/api/proposals/${p.id}/sign-link`, { method: "POST", body: {} }); navigator.clipboard && navigator.clipboard.writeText(location.origin + "/sign/" + r.token); setMsg("Sign link copied: /sign/" + r.token); }}>Copy sign link</button>
          <button className="btn ghost small" onClick={async () => { const r = await api(`/api/proposals/${p.id}/deposit`, { method: "POST", body: {} }); setMsg(`Deposit link (${r.mode}): ${r.link}`); }}>Deposit link</button>
          <a className="btn ghost small" style={{ textDecoration: "none" }} href={`/api/proposals/${p.id}/docx`}>DOCX</a>
          <button className="btn ghost small" onClick={() => transit("PROPOSAL_SENT")}>Mark sent</button></span></div>)}
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
    {rows.length === 0 && <div className="card">Inbox zero 🎉 — nothing waiting on an approver.</div>}
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

function Settings({ users, setUsers, priceBook, setPriceBook }: any) {
  const [tab, setTab] = useState("workspace");
  const [s, setS] = useState<any>(null); const [msg, setMsg] = useState("");
  const [tpls, setTpls] = useState<any[]>([]); const [svcs, setSvcs] = useState<any[]>([]);
  const [keys, setKeys] = useState<any[]>([]); const [newKey, setNewKey] = useState(""); const [hooks, setHooks] = useState<any[]>([]); const [flags, setFlags] = useState<any>({}); const [oauth, setOauth] = useState<any>(null);
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
    </div><button className="btn" style={{ marginTop: 14 }} onClick={async () => { await api("/api/settings", { method: "PATCH", body: s.workspace }); setMsg("Workspace settings saved ✓"); }}>Save workspace</button></div>}
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
      <div className="card"><h3>API keys</h3>{keys.map(k => <p key={k.id} className="muted" style={{ margin: "6px 0" }}>{k.label} · scopes {k.scopes} · {k.revoked_at ? "revoked" : "active"} {k.revoked_at ? "" : <button className="btn ghost small" onClick={async () => { await api(`/api/api-keys/${k.id}`, { method: "DELETE" }); loadAll(); }}>Revoke</button>}</p>)}
        <button className="btn" onClick={async () => { const r = await api("/api/api-keys", { method: "POST", body: { label: "Integration key" } }); setNewKey(r.key); loadAll(); }}>Generate new key</button>
        {newKey && <p className="mono ok">New key (shown once): {newKey}</p>}
        <p className="muted">Your system pulls finals from <span className="mono">GET /v1/outcomes</span> and acknowledges with <span className="mono">POST /v1/outcomes/:id/ack</span>. Push alternative: webhooks below.</p></div>
      <div className="card"><h3>Webhook endpoints (signed, HMAC)</h3>{hooks.map(h => <p key={h.id} className="muted" style={{ margin: "6px 0" }}><span className="mono">{h.url}</span> · {h.events} · {h.active ? "active" : "off"} <button className="btn ghost small" onClick={async () => { await api(`/api/webhooks/${h.id}`, { method: "DELETE" }); loadAll(); }}>Disable</button></p>)}
        <div className="rowflex"><input style={{ flex: 1 }} placeholder="https://your-system.example/webhooks/leadflow" value={nh} onChange={e => setNh(e.target.value)} /><button className="btn" onClick={async () => { await api("/api/webhooks", { method: "POST", body: { url: nh } }); setNh(""); loadAll(); }}>Add endpoint</button></div></div>
      <div className="card"><h3>Inbox connections</h3><p className="muted">Gmail: {oauth?.google?.configured ? "app configured" : "not configured on this deployment"} · Outlook: {oauth?.microsoft?.configured ? "app configured" : "not configured"}. Manual/API/CSV ingestion works regardless.</p>
        <h3 style={{ marginTop: 16 }}>Feature flags (canary)</h3>{Object.entries(flags).map(([k, v]: any) => <div className="check" key={k}><span className={`st ${v ? "pass" : "fail"}`}>{v ? "✓" : "✗"}</span><span style={{ flex: 1 }}>{k.replaceAll("_", " ")}</span><button className="btn ghost small" onClick={async () => { await api("/api/flags", { method: "POST", body: { flag: k, enabled: !v } }); loadAll(); }}>{v ? "Turn off" : "Turn on"}</button></div>)}
        <h3 style={{ marginTop: 16 }}>Website form embed (captures TCPA consent automatically)</h3><p className="mono">&lt;script src="{location.origin}/embed/v1.js" data-workspace="YOUR_WORKSPACE" data-form="#lead-form"&gt;&lt;/script&gt;</p></div>
    </div>}
  </div>);
}

function Billing() {
  const [b, setB] = useState<any>(null);
  useEffect(() => { api("/api/billing").then(setB).catch(() => {}); }, []);
  if (!b) return <p className="muted">Loading billing…</p>;
  return (<div><h2 className="pt">Billing</h2><p className="sub">Your LeadFlow subscription — plan, trial, and live usage against your caps.</p>
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
    <div className="card" style={{ padding: 6 }}><table><thead><tr><th>{ds.replaceAll("_", " ")}</th><th>Leads</th><th>Won</th><th>Lost</th><th>Pipeline value</th><th>Won value</th></tr></thead><tbody>
      {rows.map((r, i) => <tr key={i}><td><b>{r.label}</b></td><td>{num(r.leads)}</td><td>{num(r.won || 0)}</td><td>{num(r.lost || 0)}</td><td>{money(r.value)}</td><td>{money(r.won_value || 0)}</td></tr>)}
      <tr style={{ background: "#f8fafc" }}><td><b>Total</b></td><td><b>{num(tot.leads)}</b></td><td><b>{num(tot.won)}</b></td><td><b>{num(tot.lost)}</b></td><td><b>{money(tot.value)}</b></td><td><b>{money(tot.won_value)}</b></td></tr>
    </tbody></table></div></div>);
}

class EB extends React.Component<any, any> { state = { err: "" }; static getDerivedStateFromError(e: any) { return { err: String(e && e.message || e) }; } componentDidCatch(e: any, info: any) { console.error("EB-CATCH:", e.message, (info.componentStack || "").slice(0, 900)); } render() { return this.state.err ? <div className="err">Render error: {this.state.err}</div> : this.props.children; } }

function App() {
  const [user, setUser] = useState<any>(null); const [login, setLogin] = useState({ email: "", password: "" }); const [err, setErr] = useState("");
  const [nav, setNav] = useState<Nav>({ view: "dashboard" }); const [users, setUsers] = useState<any[]>([]); const [priceBook, setPriceBook] = useState<any[]>([]);
  const [brief, setBrief] = useState<any>(null); const [pending, setPending] = useState(0); const [creating, setCreating] = useState(false); const [leadId, setLeadId] = useState<string | null>(null); const [tick, setTick] = useState(0);
  useEffect(() => { api("/api/auth/me").then(r => setUser(r.user)).catch(() => {}); }, []);
  useEffect(() => { if (user) { api("/api/users").then(setUsers).catch(() => {}); api("/api/price-book").then(setPriceBook).catch(() => {}); api("/api/brief").then(setBrief).catch(() => {}); api("/api/approvals").then(r => setPending(r.length)).catch(() => {}); } }, [user, tick]);
  if (!user) return (<div className="landing">
    <h1>LeadFlow OS</h1><p className="tag">Your lead backlog, cleared. Your approvals, one tap. Your proposals, generated.</p>
    <p>Built for owner-operated service businesses drowning in leads: connect your website, inbox, or spreadsheet — we triage the pile, route only complete packets to your approval, generate the proposal from your own prices, and hand every final outcome — won, lost, or N/A — straight into your own system.</p>
    <div className="tiles">{[["Backlog Clear", "1,000-lead pile → hot / warm / stale with a projected clear date"], ["90%+ First-Pass Approvals", "Completeness Gate + price-book guardrails"], ["Generative Proposals", "From your templates and your prices. Never invented numbers."], ["Demand Gap", "The services customers ask for that you don't sell yet"]].map(([k, v]) => <div className="tile" key={k}><span>{k}</span><b style={{ fontSize: 14.5 }}>{v}</b></div>)}</div>
    <h3>Pricing — 30-day free trial, no card</h3>
    <div className="tiles">{[["Starter", "$299/mo · 500 leads · 5 seats"], ["Growth", "$599/mo · 2,000 leads · 15 seats"], ["Pro", "$999/mo · unlimited leads · 30 seats"]].map(([k, v]) => <div className="tile" key={k}><span>{k}</span><b style={{ fontSize: 14.5 }}>{v}</b></div>)}</div>
    <div className="card login"><h3>Sign in</h3>{err && <div className="err">{err}</div>}
      <input placeholder="Email" value={login.email} onChange={e => setLogin({ ...login, email: e.target.value })} />
      <input type="password" placeholder="Password" value={login.password} onChange={e => setLogin({ ...login, password: e.target.value })} />
      <button className="btn" style={{ width: "100%" }} onClick={async () => { try { const r = await api("/api/auth/login", { method: "POST", body: login }); setUser(r.user); setErr(""); } catch (e: any) { setErr(e.message); } }}>Sign in</button>
      <p className="muted" style={{ fontSize: 12.5 }}>Demo: owner@demo.test / demo1234 · <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · <a href="/dpa">DPA</a></p></div></div>);
  const go = (n: Nav) => setNav(n);
  const NavB = ({ v, children, cnt }: any) => <button className={nav.view === v ? "on" : ""} onClick={() => go({ view: v })}><span>{children}</span>{cnt ? <span className="cnt">{cnt}</span> : null}</button>;
  return (<div className="layout">
    <aside><h1>LeadFlow OS</h1><div className="who">{user.name} · {user.role}</div>
      <NavB v="dashboard">Dashboard</NavB><NavB v="leads">Leads</NavB><NavB v="reports">Reports</NavB><NavB v="approvals" cnt={pending || undefined}>Approvals</NavB><NavB v="imports">Import CSV</NavB><NavB v="demand">Demand Gap</NavB><NavB v="handoffs">Handoffs</NavB><NavB v="ops">Ops Console</NavB><NavB v="settings">Settings</NavB><NavB v="billing">Billing</NavB>
      {user.is_platform_admin ? <NavB v="admin">Platform Admin</NavB> : null}
      <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }).catch(() => {}); setUser(null); }}><span>Sign out</span></button>
      {brief && <div className="brief"><b>Morning Brief</b>{brief.headline}<br />{brief.undelivered_finals} finals not yet picked up by their system</div>}
    </aside>
    <main>
      <div className="topbar"><div className="search"><input type="search" placeholder="Search everything — name, phone, service… (opens Leads)" onKeyDown={e => { if (e.key === "Enter") go({ view: "leads", leads: { q: (e.target as HTMLInputElement).value } }); }} /></div>
        <button className="btn" onClick={() => setCreating(true)}>+ New Lead</button></div>
      <EB>
      {nav.view === "dashboard" && <Dashboard go={go} openLead={setLeadId} />}
      {nav.view === "leads" && <Leads key={JSON.stringify(nav.leads || {}) + tick} initial={nav.leads} openLead={setLeadId} users={users} me={user} />}
      {nav.view === "reports" && <Reports />}
      {nav.view === "approvals" && <Approvals openLead={setLeadId} />}
      {nav.view === "imports" && <Imports />}
      {nav.view === "demand" && <Demand />}
      {nav.view === "handoffs" && <Handoffs />}
      {nav.view === "ops" && <Ops />}
      {nav.view === "settings" && <Settings users={users} setUsers={setUsers} priceBook={priceBook} setPriceBook={setPriceBook} />}
      {nav.view === "billing" && <Billing />}
      {nav.view === "admin" && <Admin />}
      </EB>
      {creating && <CreateLead users={users} done={(id: any) => { setCreating(false); setTick(t => t + 1); if (id) setLeadId(id); }} />}
      {leadId && <LeadDetail id={leadId} users={users} priceBook={priceBook} close={() => setLeadId(null)} refresh={() => setTick(t => t + 1)} />}
    </main>
  </div>);
}
createRoot(document.getElementById("root")!).render(<App />);

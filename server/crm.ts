// Workpile v4 — Salesforce-parity CRM layer (spec v4, slices 37-46).
// Accounts/Customers + Contacts, lead conversion, Chatter feed, custom fields,
// campaigns, assignment rules, duplicates + merge, notes, files, tasks app,
// calendar, global search, favorites, report builder + dashboard pins.
// Everything here works on the real tables — no dummy data paths.
import { db, uid, now, audit, withTx } from "./db.ts";
import { VERTICAL_PACKS } from "./templates.ts";
import { storagePut, storageGet, storageDelete } from "./storage.ts";
import { financialSummary } from "./metrics.ts";
import { notify } from "./comms.ts";

const J = (s: any, fb: any = null) => { try { return JSON.parse(s ?? ""); } catch { return fb; } };
const alter = (sql: string) => { try { db.exec(sql); } catch { /* column exists */ } };

export function initCrmSchema() {
  db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, workspace_id TEXT, name TEXT, phone TEXT, email TEXT, address TEXT, website TEXT, industry TEXT, notes TEXT, custom TEXT DEFAULT '{}', created_at TEXT, updated_at TEXT);
  CREATE TABLE IF NOT EXISTS feed_posts (id TEXT PRIMARY KEY, workspace_id TEXT, entity_type TEXT, entity_id TEXT, user_id TEXT, body TEXT, created_at TEXT);
  CREATE TABLE IF NOT EXISTS follows (id TEXT PRIMARY KEY, workspace_id TEXT, user_id TEXT, entity_type TEXT, entity_id TEXT, created_at TEXT, UNIQUE(user_id, entity_type, entity_id));
  CREATE TABLE IF NOT EXISTS custom_fields (id TEXT PRIMARY KEY, workspace_id TEXT, object_type TEXT, key TEXT, label TEXT, field_type TEXT DEFAULT 'text', options TEXT DEFAULT '[]', active INTEGER DEFAULT 1, sort INTEGER DEFAULT 0, created_at TEXT, UNIQUE(workspace_id, object_type, key));
  CREATE TABLE IF NOT EXISTS campaigns (id TEXT PRIMARY KEY, workspace_id TEXT, name TEXT, type TEXT DEFAULT 'outreach', status TEXT DEFAULT 'active', starts_on TEXT, ends_on TEXT, cost REAL DEFAULT 0, notes TEXT, created_at TEXT, updated_at TEXT);
  CREATE TABLE IF NOT EXISTS campaign_members (id TEXT PRIMARY KEY, workspace_id TEXT, campaign_id TEXT, lead_id TEXT, status TEXT DEFAULT 'member', created_at TEXT, UNIQUE(campaign_id, lead_id));
  CREATE TABLE IF NOT EXISTS assignment_rules (id TEXT PRIMARY KEY, workspace_id TEXT, name TEXT, active INTEGER DEFAULT 1, sort INTEGER DEFAULT 0, field TEXT, op TEXT DEFAULT 'contains', value TEXT, assign_mode TEXT DEFAULT 'user', assign_user_id TEXT, pool TEXT DEFAULT '[]', created_at TEXT);
  CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, workspace_id TEXT, entity_type TEXT, entity_id TEXT, user_id TEXT, title TEXT, body TEXT, created_at TEXT, updated_at TEXT);
  CREATE TABLE IF NOT EXISTS favorites (id TEXT PRIMARY KEY, workspace_id TEXT, user_id TEXT, entity_type TEXT, entity_id TEXT, created_at TEXT, UNIQUE(user_id, entity_type, entity_id));
  CREATE TABLE IF NOT EXISTS dashboard_pins (id TEXT PRIMARY KEY, workspace_id TEXT, title TEXT, object_type TEXT, group_by TEXT, metric TEXT, created_by TEXT, created_at TEXT);
  `);
  alter("ALTER TABLE leads ADD COLUMN account_id TEXT");
  alter("ALTER TABLE leads ADD COLUMN converted_at TEXT");
  alter("ALTER TABLE leads ADD COLUMN campaign_id TEXT");
  alter("ALTER TABLE leads ADD COLUMN custom TEXT DEFAULT '{}'");
  alter("ALTER TABLE leads ADD COLUMN merged_into_id TEXT");
  alter("ALTER TABLE contacts ADD COLUMN account_id TEXT");
  alter("ALTER TABLE contacts ADD COLUMN title TEXT");
  alter("ALTER TABLE jobs ADD COLUMN custom TEXT DEFAULT '{}'");
}

// ---------- slice 37: conversion (Salesforce Lead -> Account + Contact + Opportunity/Job) ----------
export function convertLeadToCustomer(workspaceId: string, lead: any) {
  if (!lead) return null;
  return withTx(() => convertLeadToCustomerInner(workspaceId, lead));
}
function convertLeadToCustomerInner(workspaceId: string, lead: any) {
  const contact = db.prepare("SELECT * FROM contacts WHERE id=?").get(lead.contact_id) as any;
  let accountId = lead.account_id || contact?.account_id || null;
  if (!accountId) {
    const name = (contact?.name || "").trim();
    if (name) {
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const existing = (db.prepare("SELECT * FROM accounts WHERE workspace_id=?").all(workspaceId) as any[]).find(a => norm(a.name) === norm(name));
      if (existing) accountId = existing.id;
    }
    if (!accountId) {
      accountId = uid("acc");
      db.prepare("INSERT INTO accounts (id,workspace_id,name,phone,email,address,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)")
        .run(accountId, workspaceId, contact?.name || "Customer", contact?.phone || "", contact?.email || "", contact?.address || lead.location || "", now(), now());
    }
  }
  if (contact) db.prepare("UPDATE contacts SET account_id=?, is_customer=1 WHERE id=?").run(accountId, contact.id);
  db.prepare("UPDATE leads SET account_id=?, converted_at=COALESCE(converted_at, ?) WHERE id=?").run(accountId, now(), lead.id);
  return db.prepare("SELECT * FROM accounts WHERE id=?").get(accountId);
}
export function backfillConversions(workspaceId: string) {
  const won = db.prepare("SELECT * FROM leads WHERE workspace_id=? AND state='WON' AND account_id IS NULL").all(workspaceId) as any[];
  for (const l of won) { try { convertLeadToCustomer(workspaceId, l); } catch { /* keep listing resilient */ } }
  return won.length;
}

// ---------- slice 43: assignment rules ----------
export function applyAssignmentRules(workspaceId: string, leadish: any): string | null {
  const rules = db.prepare("SELECT * FROM assignment_rules WHERE workspace_id=? AND active=1 ORDER BY sort ASC, created_at ASC").all(workspaceId) as any[];
  const fieldVal = (f: string) => f === "service" ? (leadish.service_requested || leadish.service || "") : f === "source" ? (leadish.source || "") : f === "urgency" ? (leadish.urgency || "") : f === "value" ? String(leadish.est_value || 0) : "";
  for (const r of rules) {
    const v = fieldVal(r.field); let hit = false;
    if (r.field === "value") { const n = Number(leadish.est_value || 0); hit = r.op === "gte" ? n >= Number(r.value) : r.op === "lte" ? n <= Number(r.value) : n === Number(r.value); }
    else if (r.op === "equals") hit = v.toLowerCase() === String(r.value || "").toLowerCase();
    else hit = v.toLowerCase().includes(String(r.value || "").toLowerCase());
    if (!hit) continue;
    if (r.assign_mode === "round_robin") {
      const pool = (J(r.pool, []) as string[]).filter(id => db.prepare("SELECT id FROM users WHERE id=? AND active=1").get(id));
      if (!pool.length) continue;
      let best: string | null = null, bestN = Infinity;
      for (const pid of pool) { const n = (db.prepare("SELECT COUNT(*) c FROM leads WHERE workspace_id=? AND owner_id=? AND state IN ('NEW','WORKING','QUALIFIED','PROPOSAL','SENT','FOLLOWUP')").get(workspaceId, pid) as any).c; if (n < bestN) { bestN = n; best = pid; } }
      if (best) return best;
    } else if (r.assign_user_id) return r.assign_user_id;
  }
  return null;
}
export function onLeadCreated(workspaceId: string, leadId: string, input: any) {
  if (input?.campaign_id) {
    const c = db.prepare("SELECT id FROM campaigns WHERE id=? AND workspace_id=?").get(input.campaign_id, workspaceId);
    if (c) { db.prepare("INSERT OR IGNORE INTO campaign_members (id,workspace_id,campaign_id,lead_id,status,created_at) VALUES (?,?,?,?,?,?)").run(uid("cm"), workspaceId, input.campaign_id, leadId, "member", now()); db.prepare("UPDATE leads SET campaign_id=? WHERE id=?").run(input.campaign_id, leadId); }
  }
}

// ---------- shared lookups ----------
function leadLabel(ws: string, leadId: string) { const l = db.prepare("SELECT l.service_requested, c.name cn FROM leads l LEFT JOIN contacts c ON c.id=l.contact_id WHERE l.id=?").get(leadId) as any; return l ? `${l.cn || "Lead"} — ${l.service_requested || ""}` : leadId; }
function entityLabel(ws: string, type: string, id: string) {
  if (type === "lead") return leadLabel(ws, id);
  if (type === "job") { const j = db.prepare("SELECT lead_id FROM jobs WHERE id=?").get(id) as any; return j ? "Job: " + leadLabel(ws, j.lead_id) : id; }
  if (type === "account") { const a = db.prepare("SELECT name FROM accounts WHERE id=?").get(id) as any; return a?.name || id; }
  return id;
}

export function registerCrm(app: any, requireAuth: any, needPerm: any = null) {
  const settingsGuard = needPerm ? needPerm("can_settings") : ((_req: any, _res: any, next: any) => next());
  const approveGuard = needPerm ? needPerm("can_approve") : ((_req: any, _res: any, next: any) => next());
  initCrmSchema();
  const ws = (req: any) => req.user.workspace_id;
  const err = (res: any, code: number, msg: string) => res.status(code).json({ error: { code: "crm", message: msg } });

  // ----- Accounts / Customers -----
  app.get("/api/accounts", requireAuth, (req: any, res: any) => {
    backfillConversions(ws(req));
    const rows = db.prepare(`SELECT a.*, (SELECT COUNT(*) FROM leads l WHERE l.account_id=a.id) leads_count,
      (SELECT COUNT(*) FROM jobs j JOIN leads l2 ON l2.id=j.lead_id WHERE l2.account_id=a.id) jobs_count,
      (SELECT COALESCE(SUM(j3.value),0) FROM jobs j3 JOIN leads l3 ON l3.id=j3.lead_id WHERE l3.account_id=a.id) lifetime_value,
      (SELECT COUNT(*) FROM contacts c WHERE c.account_id=a.id) people_count
      FROM accounts a WHERE a.workspace_id=? ORDER BY a.name`).all(ws(req));
    res.json(rows);
  });
  app.post("/api/accounts", requireAuth, (req: any, res: any) => { const b = req.body || {}; if (!b.name?.trim()) return err(res, 422, "Customer name required");
    const id = uid("acc"); db.prepare("INSERT INTO accounts (id,workspace_id,name,phone,email,address,website,industry,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(id, ws(req), b.name.trim(), b.phone || "", b.email || "", b.address || "", b.website || "", b.industry || "", b.notes || "", now(), now());
    res.status(201).json(db.prepare("SELECT * FROM accounts WHERE id=?").get(id)); });
  app.get("/api/accounts/:id", requireAuth, (req: any, res: any) => {
    const a = db.prepare("SELECT * FROM accounts WHERE id=? AND workspace_id=?").get(req.params.id, ws(req)) as any; if (!a) return err(res, 404, "not found");
    const contacts = db.prepare("SELECT * FROM contacts WHERE account_id=? ORDER BY name").all(a.id);
    const leads = db.prepare("SELECT l.*, c.name contact_name FROM leads l LEFT JOIN contacts c ON c.id=l.contact_id WHERE l.account_id=? ORDER BY l.created_at DESC").all(a.id);
    const jobs = db.prepare("SELECT j.*, l.service_requested, c.name contact_name FROM jobs j JOIN leads l ON l.id=j.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE l.account_id=? ORDER BY j.created_at DESC").all(a.id);
    const lifetime = (jobs as any[]).reduce((s, j) => s + (j.value || 0), 0);
    const proposals360 = db.prepare("SELECT p.*, l.service_requested FROM proposals p JOIN leads l ON l.id=p.lead_id WHERE l.account_id=? ORDER BY p.created_at DESC").all(a.id);
    const payments360 = db.prepare("SELECT pay.*, p.lead_id FROM payments pay JOIN proposals p ON p.id=pay.proposal_id JOIN leads l ON l.id=p.lead_id WHERE l.account_id=? ORDER BY pay.created_at DESC").all(a.id);
    const docs360 = db.prepare("SELECT d.* FROM documents d WHERE d.workspace_id=? AND (d.lead_id IN (SELECT id FROM leads WHERE account_id=?) OR d.job_id IN (SELECT j.id FROM jobs j JOIN leads l ON l.id=j.lead_id WHERE l.account_id=?)) ORDER BY d.name LIMIT 50").all(a.workspace_id, a.id, a.id);
    const collected360 = (payments360 as any[]).filter(p => p.status === "paid").reduce((sm, p) => sm + (p.amount || 0), 0); const refunded360 = (payments360 as any[]).filter(p => p.status === "refunded").reduce((sm, p) => sm + (p.amount || 0), 0);
    // Definitions (audit fix): proposed = CURRENT version per lead only (older versions never double-count); signed = current signed versions; net = collected - refunded; outstanding = signed - net collected (floor 0).
    const latestProps = (proposals360 as any[]).filter(p => !(proposals360 as any[]).some(q => q.lead_id === p.lead_id && q.version > p.version));
    const proposed360 = latestProps.reduce((sm, p) => sm + (p.total || 0), 0);
    const signed360 = latestProps.filter(p => p.status === "signed").reduce((sm, p) => sm + (p.total || 0), 0);
    const net360 = collected360 - refunded360;
    const invLeadIds = (leads as any[]).map(l => l.id);
    const invoices360 = invLeadIds.length ? db.prepare(`SELECT * FROM invoices WHERE lead_id IN (${invLeadIds.map(() => "?").join(",")}) ORDER BY created_at DESC`).all(...invLeadIds) as any[] : [];
    const invoiced360 = invoices360.filter(i => i.status !== "void").reduce((a, i) => a + (i.total || 0), 0);
    const ar360 = invoices360.filter(i => ["sent", "partially_paid"].includes(i.status)).reduce((a, i) => a + ((i.total || 0) - (i.paid_amount || 0)), 0);
    const overdue360 = invoices360.filter(i => ["sent", "partially_paid"].includes(i.status) && i.due_at && new Date(i.due_at) < new Date()).reduce((a, i) => a + ((i.total || 0) - (i.paid_amount || 0)), 0);
    // Customer 360 timeline: the whole relationship, chronological (audit §1B.3)
    const tl: any[] = [];
    const leadIds = (leads as any[]).map(l => l.id);
    if (leadIds.length) {
      const ph = leadIds.map(() => "?").join(",");
      for (const e of db.prepare(`SELECT * FROM lead_events WHERE lead_id IN (${ph}) ORDER BY created_at DESC LIMIT 60`).all(...leadIds) as any[]) tl.push({ at: e.created_at, icon: "🎯", text: `Lead: ${e.type.replaceAll("_", " ")}`, lead_id: e.lead_id });
      for (const m of db.prepare(`SELECT * FROM messages_outbox WHERE lead_id IN (${ph}) ORDER BY created_at DESC LIMIT 40`).all(...leadIds) as any[]) tl.push({ at: m.created_at, icon: m.direction === "in" ? "💬" : "✉️", text: `${m.direction === "in" ? "Customer replied" : "Sent"} · ${m.channel} · ${m.status}${m.subject ? " — " + m.subject : ""}`, lead_id: m.lead_id });
      for (const ap of db.prepare(`SELECT * FROM approvals WHERE lead_id IN (${ph}) ORDER BY submitted_at DESC LIMIT 20`).all(...leadIds) as any[]) { tl.push({ at: ap.submitted_at, icon: "⚖️", text: "Approval requested", lead_id: ap.lead_id }); if (ap.decided_at) tl.push({ at: ap.decided_at, icon: ap.decision === "approved" ? "✅" : "✏️", text: `Approval ${ap.decision || "decided"}`, lead_id: ap.lead_id }); }
      for (const sg of db.prepare(`SELECT s.* FROM signatures s JOIN proposals p ON p.id=s.proposal_id WHERE p.lead_id IN (${ph})`).all(...leadIds) as any[]) tl.push({ at: sg.signed_at || sg.created_at, icon: "✍️", text: `Proposal signed by ${sg.signer_name || "customer"}`, lead_id: (proposals360 as any[]).find(p => p.id === sg.proposal_id)?.lead_id });
      for (const v of db.prepare(`SELECT * FROM site_visits WHERE lead_id IN (${ph}) ORDER BY scheduled_at DESC LIMIT 20`).all(...leadIds) as any[]) tl.push({ at: v.scheduled_at, icon: "📍", text: `Site visit · ${v.status}`, lead_id: v.lead_id });
    }
    for (const p of payments360 as any[]) tl.push({ at: p.created_at, icon: p.kind === "refund" ? "↩️" : "💳", text: `${p.kind} ${p.status} — $${p.amount}`, lead_id: p.lead_id });
    for (const j of jobs as any[]) tl.push({ at: j.created_at, icon: "🔧", text: `Job created — ${j.service_requested} · $${j.value}`, lead_id: j.lead_id, job_id: j.id });
    if (leadIds.length) { const ph2 = leadIds.map(() => "?").join(","); for (const co of db.prepare(`SELECT * FROM change_orders WHERE lead_id IN (${ph2}) ORDER BY created_at DESC LIMIT 20`).all(...leadIds) as any[]) tl.push({ at: co.created_at, icon: "📝", text: `Change order — ${co.delta_scope || "scope change"} · $${co.delta_total || 0}`, lead_id: co.lead_id }); }
    tl.sort((x, y) => String(y.at).localeCompare(String(x.at)));
    res.json({ account: { ...a, custom: J(a.custom, {}) }, contacts, leads, jobs, lifetime_value: lifetime, proposals: proposals360, payments: payments360, documents: docs360, timeline: tl.slice(0, 80), invoices: invoices360, money360: { collected: collected360, refunded: refunded360, net_collected: net360, proposals_value: proposed360, signed_value: signed360, outstanding: Math.max(0, signed360 - net360), invoiced: invoiced360, ar_outstanding: ar360, ar_overdue: overdue360, definitions: { proposed: "Current proposal version per lead", signed: "Signed current versions", collected: "Settled payments", net_collected: "Collected minus refunds", outstanding: "Uncollected contract value: signed minus net collected — includes work not yet invoiced; NOT accounts receivable", invoiced: "Invoices issued to this customer", ar_outstanding: "True receivables: invoiced and unpaid", ar_overdue: "Receivables past due" } } });
  });
  app.patch("/api/accounts/:id", requireAuth, (req: any, res: any) => { const b = req.body || {}; const F = ["name", "phone", "email", "address", "website", "industry", "notes"]; const sets = F.filter(f => b[f] !== undefined); if (!sets.length) return err(res, 422, "nothing to update");
    db.prepare(`UPDATE accounts SET ${sets.map(f => f + "=?").join(",")}, updated_at=? WHERE id=? AND workspace_id=?`).run(...sets.map(f => b[f]), now(), req.params.id, ws(req)); res.json({ ok: true }); });
  app.post("/api/leads/:id/convert", requireAuth, (req: any, res: any) => { const lead = db.prepare("SELECT * FROM leads WHERE id=? AND workspace_id=?").get(req.params.id, ws(req)) as any; if (!lead) return err(res, 404, "lead not found");
    const acc = convertLeadToCustomer(ws(req), lead); audit(ws(req), req.user.id, "lead.convert", "lead", lead.id, { account_id: acc?.id }); res.json({ account: acc }); });

  // ----- People (contacts) -----
  app.get("/api/people", requireAuth, (req: any, res: any) => { res.json(db.prepare(`SELECT c.*, a.name account_name, (SELECT COUNT(*) FROM leads l WHERE l.contact_id=c.id) leads_count FROM contacts c LEFT JOIN accounts a ON a.id=c.account_id WHERE c.workspace_id=? ORDER BY c.name`).all(ws(req))); });
  app.post("/api/people", requireAuth, (req: any, res: any) => { const b = req.body || {}; if (!b.name?.trim()) return err(res, 422, "Name required"); const id = uid("ct");
    db.prepare("INSERT INTO contacts (id,workspace_id,name,phone,email,address,account_id,title,is_customer) VALUES (?,?,?,?,?,?,?,?,?)").run(id, ws(req), b.name.trim(), b.phone || "", b.email || "", b.address || "", b.account_id || null, b.title || "", b.account_id ? 1 : 0); res.status(201).json(db.prepare("SELECT * FROM contacts WHERE id=?").get(id)); });
  app.patch("/api/people/:id", requireAuth, (req: any, res: any) => { const b = req.body || {}; const F = ["name", "phone", "email", "address", "account_id", "title"]; const sets = F.filter(f => b[f] !== undefined); if (!sets.length) return err(res, 422, "nothing to update");
    db.prepare(`UPDATE contacts SET ${sets.map(f => f + "=?").join(",")} WHERE id=? AND workspace_id=?`).run(...sets.map(f => b[f]), req.params.id, ws(req)); res.json({ ok: true }); });

  // ----- Feed (Chatter) + follows -----
  const feedList = (type: string, id: string) => db.prepare(`SELECT f.*, u.name user_name FROM feed_posts f LEFT JOIN users u ON u.id=f.user_id WHERE f.entity_type=? AND f.entity_id=? ORDER BY f.created_at ASC`).all(type, id);
  app.get("/api/feed/:type/:id", requireAuth, (req: any, res: any) => { const following = !!db.prepare("SELECT id FROM follows WHERE user_id=? AND entity_type=? AND entity_id=?").get(req.user.id, req.params.type, req.params.id); res.json({ posts: feedList(req.params.type, req.params.id), following }); });
  app.post("/api/feed/:type/:id", requireAuth, (req: any, res: any) => { const body = String(req.body?.body || "").trim(); if (!body) return err(res, 422, "Post is empty");
    const id = uid("fp"); db.prepare("INSERT INTO feed_posts (id,workspace_id,entity_type,entity_id,user_id,body,created_at) VALUES (?,?,?,?,?,?,?)").run(id, ws(req), req.params.type, req.params.id, req.user.id, body, now());
    const users = db.prepare("SELECT id, name FROM users WHERE workspace_id=? AND active=1").all(ws(req)) as any[];
    const mentioned = users.filter(u => u.id !== req.user.id && body.toLowerCase().includes("@" + u.name.split(" ")[0].toLowerCase()));
    const label = entityLabel(ws(req), req.params.type, req.params.id);
    const audience = new Set<string>(mentioned.map(u => u.id));
    for (const f of db.prepare("SELECT user_id FROM follows WHERE entity_type=? AND entity_id=?").all(req.params.type, req.params.id) as any[]) if (f.user_id !== req.user.id) audience.add(f.user_id);
    if (audience.size) notify(ws(req), [...audience], "feed.post", `${req.user.name} posted on ${label}`, body.slice(0, 140), req.params.type === "lead" ? req.params.id : undefined, { type: req.params.type, id: req.params.id });
    res.status(201).json({ posts: feedList(req.params.type, req.params.id) }); });
  app.post("/api/follow/:type/:id", requireAuth, (req: any, res: any) => { const ex = db.prepare("SELECT id FROM follows WHERE user_id=? AND entity_type=? AND entity_id=?").get(req.user.id, req.params.type, req.params.id) as any;
    if (ex) { db.prepare("DELETE FROM follows WHERE id=?").run(ex.id); return res.json({ following: false }); }
    db.prepare("INSERT INTO follows (id,workspace_id,user_id,entity_type,entity_id,created_at) VALUES (?,?,?,?,?,?)").run(uid("fol"), ws(req), req.user.id, req.params.type, req.params.id, now()); res.json({ following: true }); });

  // ----- Custom fields -----
  app.get("/api/custom-fields", requireAuth, (req: any, res: any) => { const o = req.query.object || "lead"; res.json(db.prepare("SELECT * FROM custom_fields WHERE workspace_id=? AND object_type=? AND active=1 ORDER BY sort, created_at").all(ws(req), o)); });
  app.post("/api/custom-fields", requireAuth, settingsGuard, (req: any, res: any) => { const b = req.body || {}; const key = String(b.key || b.label || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""); if (!key || !b.label) return err(res, 422, "Label required");
    const id = uid("cf"); try { db.prepare("INSERT INTO custom_fields (id,workspace_id,object_type,key,label,field_type,options,sort,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run(id, ws(req), b.object_type || "lead", key, b.label, b.field_type || "text", JSON.stringify(b.options || []), Number(b.sort) || 0, now()); } catch { return err(res, 409, "A field with that name already exists on this object"); }
    res.status(201).json(db.prepare("SELECT * FROM custom_fields WHERE id=?").get(id)); });
  app.delete("/api/custom-fields/:id", requireAuth, settingsGuard, (req: any, res: any) => { db.prepare("UPDATE custom_fields SET active=0 WHERE id=? AND workspace_id=?").run(req.params.id, ws(req)); res.json({ ok: true }); });
  app.post("/api/custom-values", requireAuth, (req: any, res: any) => { const { object_type, entity_id, values } = req.body || {}; const table = object_type === "job" ? "jobs" : object_type === "account" ? "accounts" : "leads";
    const row = db.prepare(`SELECT custom FROM ${table} WHERE id=? AND workspace_id=?`).get(entity_id, ws(req)) as any; if (!row) return err(res, 404, "record not found");
    const merged = { ...J(row.custom, {}), ...(values || {}) }; db.prepare(`UPDATE ${table} SET custom=? WHERE id=?`).run(JSON.stringify(merged), entity_id); res.json({ custom: merged }); });

  // ----- Campaigns -----
  const campaignStats = (c: any) => { const members = db.prepare("SELECT COUNT(*) n FROM campaign_members WHERE campaign_id=?").get(c.id) as any;
    const agg = db.prepare(`SELECT COUNT(DISTINCT l.id) leads, SUM(CASE WHEN l.state='WON' THEN 1 ELSE 0 END) won, COALESCE(SUM(l.est_value),0) pipeline, COALESCE(SUM(CASE WHEN l.state='WON' THEN l.est_value ELSE 0 END),0) revenue FROM campaign_members m JOIN leads l ON l.id=m.lead_id WHERE m.campaign_id=?`).get(c.id) as any;
    const cost = c.cost || 0; const revenue = agg.revenue || 0; return { members: members.n, leads: agg.leads || 0, won: agg.won || 0, pipeline: agg.pipeline || 0, revenue, roi_pct: cost > 0 ? Math.round(((revenue - cost) / cost) * 100) : null }; };
  app.get("/api/campaigns", requireAuth, (req: any, res: any) => { res.json((db.prepare("SELECT * FROM campaigns WHERE workspace_id=? ORDER BY created_at DESC").all(ws(req)) as any[]).map(c => ({ ...c, stats: campaignStats(c) }))); });
  app.post("/api/campaigns", requireAuth, (req: any, res: any) => { const b = req.body || {}; if (!b.name?.trim()) return err(res, 422, "Campaign name required"); const id = uid("camp");
    db.prepare("INSERT INTO campaigns (id,workspace_id,name,type,status,starts_on,ends_on,cost,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(id, ws(req), b.name.trim(), b.type || "outreach", "active", b.starts_on || null, b.ends_on || null, Number(b.cost) || 0, b.notes || "", now(), now());
    res.status(201).json(db.prepare("SELECT * FROM campaigns WHERE id=?").get(id)); });
  app.get("/api/campaigns/:id", requireAuth, (req: any, res: any) => { const c = db.prepare("SELECT * FROM campaigns WHERE id=? AND workspace_id=?").get(req.params.id, ws(req)) as any; if (!c) return err(res, 404, "not found");
    const members = db.prepare(`SELECT m.*, l.service_requested, l.state, l.est_value, ct.name contact_name FROM campaign_members m JOIN leads l ON l.id=m.lead_id LEFT JOIN contacts ct ON ct.id=l.contact_id WHERE m.campaign_id=? ORDER BY m.created_at DESC`).all(c.id);
    res.json({ campaign: c, stats: campaignStats(c), members }); });
  app.patch("/api/campaigns/:id", requireAuth, (req: any, res: any) => { const b = req.body || {}; const F = ["name", "type", "status", "starts_on", "ends_on", "cost", "notes"]; const sets = F.filter(f => b[f] !== undefined); if (!sets.length) return err(res, 422, "nothing to update");
    db.prepare(`UPDATE campaigns SET ${sets.map(f => f + "=?").join(",")}, updated_at=? WHERE id=? AND workspace_id=?`).run(...sets.map(f => f === "cost" ? Number(b[f]) || 0 : b[f]), now(), req.params.id, ws(req)); res.json({ ok: true }); });
  app.post("/api/campaigns/:id/members", requireAuth, (req: any, res: any) => { const ids: string[] = req.body?.lead_ids || []; let added = 0;
    for (const lid of ids) { const l = db.prepare("SELECT id FROM leads WHERE id=? AND workspace_id=?").get(lid, ws(req)); if (!l) continue; const r = db.prepare("INSERT OR IGNORE INTO campaign_members (id,workspace_id,campaign_id,lead_id,status,created_at) VALUES (?,?,?,?,?,?)").run(uid("cm"), ws(req), req.params.id, lid, "member", now()); if (r.changes) { added++; db.prepare("UPDATE leads SET campaign_id=? WHERE id=? AND (campaign_id IS NULL OR campaign_id='')").run(req.params.id, lid); } }
    res.json({ added }); });
  app.patch("/api/campaign-members/:id", requireAuth, (req: any, res: any) => { db.prepare("UPDATE campaign_members SET status=? WHERE id=? AND workspace_id=?").run(req.body?.status || "member", req.params.id, ws(req)); res.json({ ok: true }); });
  app.delete("/api/campaign-members/:id", requireAuth, (req: any, res: any) => { db.prepare("DELETE FROM campaign_members WHERE id=? AND workspace_id=?").run(req.params.id, ws(req)); res.json({ ok: true }); });

  // ----- Assignment rules -----
  app.get("/api/assignment-rules", requireAuth, (req: any, res: any) => { res.json(db.prepare("SELECT * FROM assignment_rules WHERE workspace_id=? ORDER BY sort, created_at").all(ws(req))); });
  app.post("/api/assignment-rules", requireAuth, settingsGuard, (req: any, res: any) => { const b = req.body || {}; if (!b.field || b.value === undefined) return err(res, 422, "Rule needs a field and a value"); const id = uid("ar");
    db.prepare("INSERT INTO assignment_rules (id,workspace_id,name,sort,field,op,value,assign_mode,assign_user_id,pool,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(id, ws(req), b.name || "Rule", Number(b.sort) || 0, b.field, b.op || "contains", String(b.value), b.assign_mode || "user", b.assign_user_id || null, JSON.stringify(b.pool || []), now());
    res.status(201).json(db.prepare("SELECT * FROM assignment_rules WHERE id=?").get(id)); });
  app.patch("/api/assignment-rules/:id", requireAuth, settingsGuard, (req: any, res: any) => { const b = req.body || {}; const F = ["name", "active", "sort", "field", "op", "value", "assign_mode", "assign_user_id"]; const sets = F.filter(f => b[f] !== undefined);
    if (b.pool !== undefined) { sets.push("pool" as any); } if (!sets.length) return err(res, 422, "nothing to update");
    const vals = sets.map(f => f === "pool" ? JSON.stringify(b.pool || []) : b[f]); db.prepare(`UPDATE assignment_rules SET ${sets.map(f => f + "=?").join(",")} WHERE id=? AND workspace_id=?`).run(...vals, req.params.id, ws(req)); res.json({ ok: true }); });
  app.delete("/api/assignment-rules/:id", requireAuth, settingsGuard, (req: any, res: any) => { db.prepare("DELETE FROM assignment_rules WHERE id=? AND workspace_id=?").run(req.params.id, ws(req)); res.json({ ok: true }); });

  // ----- Duplicates + merge -----
  app.get("/api/proposals", requireAuth, (req: any, res: any) => { const rows = db.prepare(`SELECT p.*, l.service_requested, l.state lead_state, c.name contact_name, (SELECT COALESCE(SUM(amount),0) FROM payments WHERE proposal_id=p.id AND status='paid') paid_total, (SELECT COALESCE(SUM(amount),0) FROM payments WHERE proposal_id=p.id AND kind='refund' AND status='refunded') refunded_total FROM proposals p LEFT JOIN leads l ON l.id=p.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE p.workspace_id=? ORDER BY p.created_at DESC LIMIT 300`).all(ws(req)); res.json(rows); });
  app.post("/api/proposals/:id/refund", requireAuth, approveGuard, (req: any, res: any) => { const p = db.prepare("SELECT * FROM proposals WHERE id=? AND workspace_id=?").get(req.params.id, ws(req)) as any; if (!p) return res.status(404).json({ error: { code: "not_found" } }); const amount = Number(req.body?.amount || 0); const paid = (db.prepare("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE proposal_id=? AND status='paid'").get(p.id) as any).s; const refunded = (db.prepare("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE proposal_id=? AND kind='refund' AND status='refunded'").get(p.id) as any).s; if (!(amount > 0) || amount > paid - refunded + 0.001) return res.status(422).json({ error: { code: "bad_amount", message: `Refund must be between $0 and the un-refunded paid balance ($${Math.max(0, paid - refunded)})` } }); const lastPay = db.prepare("SELECT mode FROM payments WHERE proposal_id=? ORDER BY created_at DESC").get(p.id) as any; const id = uid("pay"); db.prepare("INSERT INTO payments (id,workspace_id,proposal_id,kind,amount,mode,status,created_at,paid_at) VALUES (?,?,?, 'refund', ?, ?, 'refunded', ?, ?)").run(id, ws(req), p.id, amount, lastPay?.mode || "test", now(), now()); const newRefunded = refunded + amount; db.prepare("UPDATE proposals SET payment_status=? WHERE id=?").run(newRefunded >= paid - 0.001 ? "refunded" : "partially_refunded", p.id); audit(ws(req), req.user.id, "payment.refunded", "proposal", p.id, { amount, reason: String(req.body?.reason || "").slice(0, 200) }); res.status(201).json({ ok: true, refund_id: id, amount, refunded_total: newRefunded, payment_status: newRefunded >= paid - 0.001 ? "refunded" : "partially_refunded" }); });
  app.get("/api/suppressions", requireAuth, (req: any, res: any) => { res.json(db.prepare("SELECT * FROM suppressions WHERE workspace_id=? ORDER BY created_at DESC").all(ws(req))); });
  app.post("/api/suppressions", requireAuth, settingsGuard, (req: any, res: any) => { const kind = req.body?.kind === "phone" ? "phone" : "email"; const raw = String(req.body?.value || "").trim(); const value = kind === "email" ? raw.toLowerCase() : raw.replace(/\D/g, ""); if (!value) return res.status(422).json({ error: { code: "value_required" } }); const id = uid("sup"); try { db.prepare("INSERT INTO suppressions (id,workspace_id,kind,value,reason,source,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)").run(id, ws(req), kind, value, String(req.body?.reason || "").slice(0, 200), "manual", req.user.id, now()); } catch { return res.status(409).json({ error: { code: "already_suppressed" } }); } audit(ws(req), req.user.id, "suppression.added", "suppression", id, { kind }); res.status(201).json(db.prepare("SELECT * FROM suppressions WHERE id=?").get(id)); });
  app.delete("/api/suppressions/:id", requireAuth, settingsGuard, (req: any, res: any) => { db.prepare("DELETE FROM suppressions WHERE id=? AND workspace_id=?").run(req.params.id, ws(req)); res.json({ ok: true }); });
  app.get("/api/duplicates/merges", requireAuth, (req: any, res: any) => { res.json(db.prepare("SELECT ms.id, ms.dupe_id, ms.survivor_id, ms.created_at, ms.reversed_at, c.name survivor_name FROM merge_snapshots ms LEFT JOIN leads sl ON sl.id=ms.survivor_id LEFT JOIN contacts c ON c.id=sl.contact_id WHERE ms.workspace_id=? ORDER BY ms.created_at DESC LIMIT 25").all(ws(req))); });
  app.post("/api/duplicates/merges/:id/reverse", requireAuth, settingsGuard, (req: any, res: any) => { const ms = db.prepare("SELECT * FROM merge_snapshots WHERE id=? AND workspace_id=?").get(req.params.id, ws(req)) as any; if (!ms) return res.status(404).json({ error: { code: "not_found" } }); if (ms.reversed_at) return res.status(409).json({ error: { code: "already_reversed" } }); const snap = JSON.parse(ms.snapshot || "{}"); const lead = snap.lead; if (!lead?.id) return res.status(422).json({ error: { code: "bad_snapshot" } }); const cols = Object.keys(lead).filter(k => k !== "id"); db.prepare(`UPDATE leads SET ${cols.map(k => `${k}=?`).join(", ")} WHERE id=?`).run(...cols.map(k => lead[k]), lead.id); if (snap.contact?.id) db.prepare("UPDATE contacts SET merged_into_id=NULL WHERE id=?").run(snap.contact.id); db.prepare("UPDATE merge_snapshots SET reversed_at=? WHERE id=?").run(now(), ms.id); audit(ws(req), req.user.id, "lead.merge_reversed", "lead", lead.id, { survivor_id: ms.survivor_id }); res.json({ ok: true, restored_lead_id: lead.id, note: "Lead and contact restored to their pre-merge state. Proposals, tasks and messages created or moved after the merge stay with the survivor — reassign them manually if needed." }); });
  app.get("/api/templates/verticals", requireAuth, (req: any, res: any) => { res.json(VERTICAL_PACKS.map(p => ({ id: p.id, name: p.name, services: p.services.length, fields: p.fields.length }))); });
  app.post("/api/templates/verticals/:id/apply", requireAuth, settingsGuard, (req: any, res: any) => { const pack = VERTICAL_PACKS.find(p => p.id === req.params.id); if (!pack) return res.status(404).json({ error: { code: "pack_not_found" } }); const w = ws(req); let services = 0, items = 0, fields = 0; for (const name of pack.services) { if (!db.prepare("SELECT id FROM services WHERE workspace_id=? AND name=?").get(w, name)) { db.prepare("INSERT INTO services (id,workspace_id,name,active,is_catalog) VALUES (?,?,?,1,1)").run(uid("svc"), w, name); services++; } if (!db.prepare("SELECT id FROM price_book_items WHERE workspace_id=? AND name=?").get(w, name)) { db.prepare("INSERT INTO price_book_items (id,workspace_id,name,unit,standard_price,floor_price) VALUES (?,?,?,'job',0,0)").run(uid("pb"), w, name); items++; } } for (const f of pack.fields) { if (!db.prepare("SELECT id FROM custom_fields WHERE workspace_id=? AND object_type='lead' AND key=?").get(w, f.key)) { db.prepare("INSERT INTO custom_fields (id,workspace_id,object_type,key,label,field_type,created_at) VALUES (?,?, 'lead',?,?, 'text', ?)").run(uid("cf"), w, f.key, f.label, now()); fields++; } } audit(w, req.user.id, "templates.vertical_applied", "workspace", w, { pack: pack.id, services, items, fields }); res.json({ ok: true, pack: pack.id, added: { services, price_book_items: items, custom_fields: fields }, note: "Price-book items land at $0 — set your own prices in Settings → Price Book." }); });
  app.post("/api/attachments", requireAuth, (req: any, res: any) => { const b = req.body || {}; const et = String(b.entity_type || "lead"); const eid = String(b.entity_id || ""); const table = et === "job" ? "jobs" : et === "customer" ? "customers" : "leads"; const ent = db.prepare(`SELECT id FROM ${table} WHERE id=? AND workspace_id=?`).get(eid, ws(req)) as any; if (!ent) return res.status(404).json({ error: { code: "entity_not_found" } }); const data = String(b.data_base64 || ""); if (!data || data.length > 7_000_000) return res.status(422).json({ error: { code: "file_too_large", message: "Attachment missing or over ~5MB" } }); const buf = Buffer.from(data, "base64"); const id = uid("att"); const name = String(b.name || "file").slice(0, 120); const key = storagePut(`${ws(req)}/${et}/${eid}/${id}-${name}`, buf); db.prepare("INSERT INTO attachments (id,workspace_id,entity_type,entity_id,name,mime,size,storage_key,uploaded_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run(id, ws(req), et, eid, name, String(b.mime || "application/octet-stream").slice(0, 80), buf.length, key, req.user.id, now()); res.status(201).json(db.prepare("SELECT id,entity_type,entity_id,name,mime,size,created_at FROM attachments WHERE id=?").get(id)); });
  app.get("/api/attachments", requireAuth, (req: any, res: any) => { res.json(db.prepare("SELECT id,entity_type,entity_id,name,mime,size,created_at FROM attachments WHERE workspace_id=? AND entity_type=? AND entity_id=? ORDER BY created_at DESC").all(ws(req), String(req.query.entity_type || "lead"), String(req.query.entity_id || ""))); });
  app.get("/api/attachments/:id/download", requireAuth, (req: any, res: any) => { const a = db.prepare("SELECT * FROM attachments WHERE id=? AND workspace_id=?").get(req.params.id, ws(req)) as any; if (!a) return res.status(404).json({ error: { code: "not_found" } }); const buf = storageGet(a.storage_key); if (!buf) return res.status(404).json({ error: { code: "file_gone" } }); res.setHeader("Content-Type", a.mime || "application/octet-stream"); res.setHeader("Content-Disposition", `attachment; filename="${String(a.name).replace(/"/g, "")}"`); res.send(buf); });
  app.delete("/api/attachments/:id", requireAuth, (req: any, res: any) => { const a = db.prepare("SELECT * FROM attachments WHERE id=? AND workspace_id=?").get(req.params.id, ws(req)) as any; if (!a) return res.status(404).json({ error: { code: "not_found" } }); storageDelete(a.storage_key); db.prepare("DELETE FROM attachments WHERE id=?").run(a.id); res.json({ ok: true }); });
  app.get("/api/duplicates", requireAuth, (req: any, res: any) => {
    const W = ws(req);
    const leadRow = (l: any) => ({ id: l.id, service_requested: l.service_requested, state: l.state, est_value: l.est_value, created_at: l.created_at, contact_name: l.contact_name, contact_phone: l.contact_phone, contact_email: l.contact_email, location: l.location });
    const all = db.prepare(`SELECT l.id, l.service_requested, l.state, l.est_value, l.created_at, l.dedupe_key, l.location, c.name contact_name, c.phone contact_phone, c.email contact_email FROM leads l LEFT JOIN contacts c ON c.id=l.contact_id WHERE l.workspace_id=? AND l.state!='DUPLICATE' AND l.merged_into_id IS NULL ORDER BY l.created_at`).all(W) as any[];
    const groups: any[] = []; const used = new Set<string>();
    const byKey = new Map<string, any[]>();
    for (const l of all) { if (!l.dedupe_key) continue; if (!byKey.has(l.dedupe_key)) byKey.set(l.dedupe_key, []); byKey.get(l.dedupe_key)!.push(l); }
    for (const [key, ls] of byKey) if (ls.length > 1) { ls.forEach(l => used.add(l.id)); groups.push({ key, count: ls.length, match_type: "exact", confidence: 0.99, signals: ["normalized phone/email identity"], leads: ls.map(leadRow) }); }
    const norm = (v: string) => String(v || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const digits = (v: string) => String(v || "").replace(/\D/g, "").slice(-10);
    const rest = all.filter(l => !used.has(l.id));
    const cand = new Map<string, { leads: any[]; signals: string[]; confidence: number }>();
    const push = (k: string, l: any, signals: string[], confidence: number) => { if (!cand.has(k)) cand.set(k, { leads: [], signals, confidence }); const g = cand.get(k)!; if (!g.leads.find(x => x.id === l.id)) g.leads.push(l); };
    for (const l of rest) {
      if (l.contact_email) push("em:" + norm(l.contact_email), l, ["same email"], 0.95);
      if (digits(l.contact_phone).length === 10) push("ph:" + digits(l.contact_phone), l, ["same phone"], 0.97);
      if (norm(l.contact_name)) { push("ns:" + norm(l.contact_name) + "|" + norm(l.service_requested), l, ["same name + service"], 0.7); push("nl:" + norm(l.contact_name) + "|" + norm(l.location), l, ["same name + location"], 0.65); }
    }
    for (const [k, g] of cand) if (g.leads.length > 1) groups.push({ key: k, count: g.leads.length, match_type: "candidate", confidence: g.confidence, signals: g.signals, leads: g.leads.map(leadRow) });
    groups.sort((a, b) => b.confidence - a.confidence || b.count - a.count);
    res.json(groups); });
  app.post("/api/leads/:id/merge", requireAuth, (req: any, res: any) => { const dupe = db.prepare("SELECT * FROM leads WHERE id=? AND workspace_id=?").get(req.params.id, ws(req)) as any; const into = db.prepare("SELECT * FROM leads WHERE id=? AND workspace_id=?").get(req.body?.into_id, ws(req)) as any;
    if (!dupe || !into || dupe.id === into.id) return err(res, 422, "Pick two different leads");
    try { const dupeContact = dupe.contact_id ? db.prepare("SELECT * FROM contacts WHERE id=?").get(dupe.contact_id) : null; db.prepare("INSERT INTO merge_snapshots (id,workspace_id,survivor_id,dupe_id,snapshot,created_by,created_at) VALUES (?,?,?,?,?,?,?)").run(uid("msn"), ws(req), into.id, dupe.id, JSON.stringify({ lead: dupe, contact: dupeContact }), req.user.id, now()); } catch {}
    for (const t of ["activities", "tasks", "proposals", "documents", "time_entries", "job_crew", "job_schedule", "lead_events", "inbox_items", "signatures"]) { try { db.prepare(`UPDATE ${t} SET lead_id=? WHERE lead_id=?`).run(into.id, dupe.id); } catch { /* table shape varies */ } }
    try { db.prepare("UPDATE followup_enrollments SET lead_id=? WHERE lead_id=?").run(into.id, dupe.id); } catch {}
    try { db.prepare("UPDATE campaign_members SET lead_id=? WHERE lead_id=?").run(into.id, dupe.id); } catch {}
    try { db.prepare("UPDATE feed_posts SET entity_id=? WHERE entity_type='lead' AND entity_id=?").run(into.id, dupe.id); } catch {}
    db.prepare("UPDATE leads SET state='DUPLICATE', merged_into_id=?, updated_at=? WHERE id=?").run(into.id, now(), dupe.id);
    audit(ws(req), req.user.id, "lead.merge", "lead", dupe.id, { into_id: into.id }); res.json({ ok: true, survivor: into.id }); });

  // ----- Notes + Files -----
  app.get("/api/notes", requireAuth, (req: any, res: any) => { const { entity_type, entity_id } = req.query as any; const base = `SELECT n.*, u.name user_name FROM notes n LEFT JOIN users u ON u.id=n.user_id WHERE n.workspace_id=?`;
    const rows = entity_id ? db.prepare(base + " AND n.entity_type=? AND n.entity_id=? ORDER BY n.created_at DESC").all(ws(req), entity_type, entity_id) : db.prepare(base + " ORDER BY n.created_at DESC LIMIT 200").all(ws(req));
    res.json((rows as any[]).map(n => ({ ...n, entity_label: n.entity_id ? entityLabel(ws(req), n.entity_type, n.entity_id) : "" }))); });
  app.post("/api/notes", requireAuth, (req: any, res: any) => { const b = req.body || {}; if (!String(b.body || "").trim() && !String(b.title || "").trim()) return err(res, 422, "Note is empty"); const id = uid("note");
    db.prepare("INSERT INTO notes (id,workspace_id,entity_type,entity_id,user_id,title,body,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").run(id, ws(req), b.entity_type || "lead", b.entity_id || null, req.user.id, b.title || "", b.body || "", now(), now()); res.status(201).json(db.prepare("SELECT * FROM notes WHERE id=?").get(id)); });
  app.delete("/api/notes/:id", requireAuth, (req: any, res: any) => { db.prepare("DELETE FROM notes WHERE id=? AND workspace_id=?").run(req.params.id, ws(req)); res.json({ ok: true }); });
  app.get("/api/files", requireAuth, (req: any, res: any) => { const docs = db.prepare(`SELECT d.id, d.name, d.status, d.required, d.received_at, d.lead_id, d.job_id, 'document' kind, l.service_requested, c.name contact_name FROM documents d LEFT JOIN leads l ON l.id=d.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE d.workspace_id=? ORDER BY d.name`).all(ws(req));
    let ups: any[] = []; try { ups = db.prepare(`SELECT p.id, p.filename name, 'received' status, 0 required, p.created_at received_at, p.lead_id, NULL job_id, 'upload' kind, l.service_requested, c.name contact_name FROM portal_uploads p LEFT JOIN leads l ON l.id=p.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE p.workspace_id=?`).all(ws(req)); } catch {}
    res.json([...(docs as any[]), ...ups]); });

  // ----- Tasks app + Calendar -----
  app.get("/api/tasks-all", requireAuth, (req: any, res: any) => { const f = String(req.query.filter || "open"); let cond = "t.status='open'";
    if (f === "mine") cond = `t.status='open' AND t.assignee_id='${req.user.id}'`; if (f === "overdue") cond = "t.status='open' AND t.due_at < datetime('now')"; if (f === "done") cond = "t.status='done'";
    if (f !== "done") cond = `(${cond}) AND (t.snooze_until IS NULL OR t.snooze_until<=datetime('now'))`; res.json(db.prepare(`SELECT t.*, l.service_requested, c.name contact_name, u.name assignee_name FROM tasks t LEFT JOIN leads l ON l.id=t.lead_id LEFT JOIN contacts c ON c.id=l.contact_id LEFT JOIN users u ON u.id=t.assignee_id WHERE t.workspace_id=? AND ${cond} ORDER BY t.due_at ASC LIMIT 300`).all(ws(req))); });
  app.get("/api/calendar", requireAuth, (req: any, res: any) => { const from = String(req.query.from || new Date().toISOString().slice(0, 10)); const to = String(req.query.to || new Date(Date.now() + 42 * 86400000).toISOString().slice(0, 10)); const ev: any[] = []; const wantDone = String(req.query.done || "") === "1";
    for (const t of db.prepare(`SELECT t.*, l.service_requested, c.name contact_name FROM tasks t LEFT JOIN leads l ON l.id=t.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE t.workspace_id=? AND (t.status='open'${wantDone ? " OR t.status='done'" : ""}) AND date(t.due_at) BETWEEN date(?) AND date(?)`).all(ws(req), from, to) as any[]) ev.push({ id: "task" + t.id, date: String(t.due_at).slice(0, 10), kind: t.status === "done" ? "task_done" : "task", title: t.title, sub: `${t.contact_name || ""} — ${t.service_requested || ""}`, lead_id: t.lead_id });
    for (const c of db.prepare(`SELECT cb.*, l.service_requested, ct.name contact_name FROM callbacks cb LEFT JOIN leads l ON l.id=cb.lead_id LEFT JOIN contacts ct ON ct.id=l.contact_id WHERE cb.workspace_id=? AND cb.status='open' AND date(cb.due_at) BETWEEN date(?) AND date(?)`).all(ws(req), from, to) as any[]) ev.push({ id: "cb" + c.id, date: String(c.due_at).slice(0, 10), kind: "callback", title: "📞 Callback" + (c.note ? " — " + c.note : ""), sub: `${c.contact_name || ""} — ${c.service_requested || ""}`, lead_id: c.lead_id });
    for (const s of db.prepare(`SELECT s.*, l.service_requested, c.name contact_name, COALESCE(w.name, u.name) worker FROM job_schedule s LEFT JOIN leads l ON l.id=s.lead_id LEFT JOIN contacts c ON c.id=l.contact_id LEFT JOIN workers w ON w.id=s.worker_id LEFT JOIN users u ON u.id=s.user_id WHERE s.workspace_id=? AND s.work_date BETWEEN ? AND ?`).all(ws(req), from, to) as any[]) ev.push({ id: "sch" + s.id, date: s.work_date, kind: "schedule", title: `👷 ${s.worker || "Crew"} on site`, sub: `${s.contact_name || ""} — ${s.service_requested || ""}`, lead_id: s.lead_id });
    for (const f2 of db.prepare(`SELECT f.*, l.service_requested, c.name contact_name FROM followup_enrollments f LEFT JOIN leads l ON l.id=f.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE f.workspace_id=? AND f.status='active' AND date(f.next_due_at) BETWEEN date(?) AND date(?)`).all(ws(req), from, to) as any[]) ev.push({ id: "fu" + f2.id, date: String(f2.next_due_at).slice(0, 10), kind: "followup", title: `🔁 Follow-up step ${(f2.step_idx || 0) + 1}`, sub: `${f2.contact_name || ""} — ${f2.service_requested || ""}`, lead_id: f2.lead_id });
    for (const v of db.prepare(`SELECT v.*, l.service_requested, c.name contact_name FROM site_visits v LEFT JOIN leads l ON l.id=v.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE v.workspace_id=? AND date(v.scheduled_at) BETWEEN date(?) AND date(?)`).all(ws(req), from, to) as any[]) ev.push({ id: "sv" + v.id, date: String(v.scheduled_at).slice(0, 10), kind: "visit", title: "📍 Site visit", sub: `${v.contact_name || ""} — ${v.service_requested || ""}`, lead_id: v.lead_id });
    ev.sort((a, b) => a.date.localeCompare(b.date)); res.json(ev); });

  // ----- Global search + favorites -----
  app.get("/api/search", requireAuth, (req: any, res: any) => { const q = String(req.query.q || "").trim(); if (q.length < 2) return res.json({ leads: [], jobs: [], accounts: [], people: [], tasks: [], campaigns: [] }); const like = "%" + q + "%"; const W = ws(req);
    const leads = db.prepare(`SELECT l.id, l.service_requested title, l.state sub, c.name contact_name FROM leads l LEFT JOIN contacts c ON c.id=l.contact_id WHERE l.workspace_id=? AND (c.name LIKE ? OR l.service_requested LIKE ? OR c.email LIKE ? OR c.phone LIKE ?) AND l.state!='DUPLICATE' ORDER BY l.updated_at DESC LIMIT 8`).all(W, like, like, like, like);
    const jobs = db.prepare(`SELECT j.id, l.service_requested title, j.stage sub, c.name contact_name FROM jobs j JOIN leads l ON l.id=j.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE j.workspace_id=? AND (c.name LIKE ? OR l.service_requested LIKE ?) LIMIT 8`).all(W, like, like);
    const accounts = db.prepare(`SELECT id, name title, industry sub FROM accounts WHERE workspace_id=? AND name LIKE ? LIMIT 8`).all(W, like);
    const people = db.prepare(`SELECT id, name title, email sub FROM contacts WHERE workspace_id=? AND (name LIKE ? OR email LIKE ?) LIMIT 8`).all(W, like, like);
    const tasks = db.prepare(`SELECT id, title, due_at sub, lead_id FROM tasks WHERE workspace_id=? AND title LIKE ? AND status='open' LIMIT 8`).all(W, like);
    const campaigns = db.prepare(`SELECT id, name title, status sub FROM campaigns WHERE workspace_id=? AND name LIKE ? LIMIT 8`).all(W, like);
    res.json({ leads, jobs, accounts, people, tasks, campaigns }); });
  app.get("/api/favorites", requireAuth, (req: any, res: any) => { const rows = db.prepare("SELECT * FROM favorites WHERE user_id=? ORDER BY created_at DESC").all(req.user.id) as any[]; res.json(rows.map(f => ({ ...f, label: entityLabel(ws(req), f.entity_type, f.entity_id) }))); });
  app.post("/api/favorites", requireAuth, (req: any, res: any) => { const { entity_type, entity_id } = req.body || {}; const ex = db.prepare("SELECT id FROM favorites WHERE user_id=? AND entity_type=? AND entity_id=?").get(req.user.id, entity_type, entity_id) as any;
    if (ex) { db.prepare("DELETE FROM favorites WHERE id=?").run(ex.id); return res.json({ favorite: false }); }
    db.prepare("INSERT INTO favorites (id,workspace_id,user_id,entity_type,entity_id,created_at) VALUES (?,?,?,?,?,?)").run(uid("fav"), ws(req), req.user.id, entity_type, entity_id, now()); res.json({ favorite: true }); });

  // ----- Report builder + dashboard pins -----
  app.post("/api/reports/build", requireAuth, (req: any, res: any) => { const { object_type = "leads", group_by = "state", metric = "count" } = req.body || {}; const W = ws(req);
    const GROUPS: Record<string, string> = { state: "l.state", source: "COALESCE(s.name,'Unknown')", owner: "COALESCE(u.name,'Unassigned')", service: "l.service_requested", month: "substr(l.created_at,1,7)", job_stage: "j.stage", sector: "COALESCE(j.sector,'private')" };
    const g = GROUPS[group_by] || "l.state"; let rows: any[];
    if (object_type === "jobs") rows = db.prepare(`SELECT ${g} k, COUNT(*) count, COALESCE(SUM(j.value),0) value FROM jobs j JOIN leads l ON l.id=j.lead_id LEFT JOIN sources s ON s.id=l.source_id LEFT JOIN users u ON u.id=l.owner_id WHERE j.workspace_id=? GROUP BY k ORDER BY value DESC`).all(W);
    else rows = db.prepare(`SELECT ${g} k, COUNT(*) count, COALESCE(SUM(l.est_value),0) value FROM leads l LEFT JOIN sources s ON s.id=l.source_id LEFT JOIN users u ON u.id=l.owner_id LEFT JOIN jobs j ON j.lead_id=l.id WHERE l.workspace_id=? AND l.state!='DUPLICATE' GROUP BY k ORDER BY value DESC`).all(W);
    res.json({ rows: (rows as any[]).map(r => ({ key: String(r.k ?? "—"), count: r.count, value: r.value })), metric }); });
  app.get("/api/dashboard-pins", requireAuth, (req: any, res: any) => { res.json(db.prepare("SELECT * FROM dashboard_pins WHERE workspace_id=? ORDER BY created_at").all(ws(req))); });
  app.post("/api/dashboard-pins", requireAuth, (req: any, res: any) => { const b = req.body || {}; const id = uid("pin"); db.prepare("INSERT INTO dashboard_pins (id,workspace_id,title,object_type,group_by,metric,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)").run(id, ws(req), b.title || "Report", b.object_type || "leads", b.group_by || "state", b.metric || "count", req.user.id, now()); res.status(201).json(db.prepare("SELECT * FROM dashboard_pins WHERE id=?").get(id)); });
  app.delete("/api/dashboard-pins/:id", requireAuth, (req: any, res: any) => { db.prepare("DELETE FROM dashboard_pins WHERE id=? AND workspace_id=?").run(req.params.id, ws(req)); res.json({ ok: true }); });
}

// ---------- v5 slice 50: proposal document templates (variety, logo, rich content) ----------
import { DEFAULT_INTRO, DEFAULT_TERMS, DEFAULT_FOOTER, sanitizeHtml } from "./proptemplate.ts";
const DOC_SEEDS: [string, string, string][] = [
  ["Standard Proposal", DEFAULT_INTRO, DEFAULT_TERMS],
  ["Detailed Scope & Terms", "<p>Dear {customer},</p><p>Thank you for the opportunity to propose on your {service} project at {location}. This proposal is built from our on-site assessment and is organized so you can see exactly what is included, what is assumed, and what is excluded — before you sign.</p><h3>Scope of work</h3><p>The line items below are the complete scope. Anything not listed is not included unless added by written change order.</p><h3>Assumptions</h3><ul><li>Unobstructed access to all work areas during business hours.</li><li>Utilities (water, power) available at the site.</li><li>No concealed conditions beyond those noted in the assessment.</li></ul><h3>Exclusions</h3><ul><li>Permits and municipal fees unless listed as a line item.</li><li>Work by other trades unless listed.</li></ul>", "<p>Proposal valid for 30 days. Deposit due on signing; progress billing as phases complete; balance on substantial completion. Change orders are written, priced from the same price book, and approved before work proceeds. Concealed conditions are documented with photos and priced before proceeding. All work is performed by licensed, insured personnel and warranted for one year from completion.</p>"],
  ["Government & Prevailing Wage", "<p>Dear {customer},</p><p>Thank you for the opportunity to propose on your {service} project at {location}. This proposal is prepared for public-sector review: all labor is priced at applicable prevailing-wage rates, and certified payroll records are available on request.</p><h3>Compliance</h3><ul><li>Prevailing wage rates applied per the current determination for the project county.</li><li>Certified payroll submitted weekly during performance.</li><li>Certificate of insurance and W-9 available with this proposal.</li><li>All personnel are background-checked and badged for institutional sites.</li></ul>", "<p>Proposal valid for 45 days. Invoicing follows the agency's standard payment cycle with certified payroll attached. Liquidated damages, if any, apply only as stated in the governing contract. All work is performed by licensed, insured personnel; bonds available on request.</p>"],
  ["Short & Simple", "<p>Hi {customer} — here's our price for your {service} project. Everything's in the lines below; the total is the total.</p>", "<p>Good for 14 days. Deposit on signing, balance when we're done. If anything changes, we price it in writing before we do it. Licensed & insured.</p>"],
];
export function ensureDocTemplates(workspaceId: string) {
  db.exec("CREATE TABLE IF NOT EXISTS doc_templates (id TEXT PRIMARY KEY, workspace_id TEXT, name TEXT, intro_html TEXT, terms_html TEXT, footer TEXT, include_logo INTEGER DEFAULT 1, is_default INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT)");
  const n = (db.prepare("SELECT COUNT(*) c FROM doc_templates WHERE workspace_id=?").get(workspaceId) as any).c;
  if (n > 0) return;
  DOC_SEEDS.forEach(([name, intro, terms], i) => {
    db.prepare("INSERT INTO doc_templates (id,workspace_id,name,intro_html,terms_html,footer,include_logo,is_default,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .run(uid("dtpl"), workspaceId, name, intro, terms, DEFAULT_FOOTER, 1, i === 0 ? 1 : 0, now(), now());
  });
}
export function registerDocTemplates(app: any, requireAuth: any, needPerm: any = null) {
  const settingsGuard = needPerm ? needPerm("can_settings") : ((_req: any, _res: any, next: any) => next());
  ensureDocTemplates("__boot__"); // creates the table on a scratch key; seeds happen per-workspace on first list
  const ws = (req: any) => req.user.workspace_id;
  const err = (res: any, code: number, msg: string) => res.status(code).json({ error: { code: "doctpl", message: msg } });
  app.get("/api/doc-templates", requireAuth, (req: any, res: any) => { ensureDocTemplates(ws(req)); res.json(db.prepare("SELECT * FROM doc_templates WHERE workspace_id=? ORDER BY is_default DESC, created_at").all(ws(req))); });
  app.post("/api/doc-templates", requireAuth, settingsGuard, (req: any, res: any) => { const b = req.body || {}; ensureDocTemplates(ws(req)); const id = uid("dtpl");
    const src = b.from_id ? db.prepare("SELECT * FROM doc_templates WHERE id=? AND workspace_id=?").get(b.from_id, ws(req)) as any : null;
    db.prepare("INSERT INTO doc_templates (id,workspace_id,name,intro_html,terms_html,footer,include_logo,is_default,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .run(id, ws(req), (b.name || src?.name + " (copy)" || "New template").slice(0, 120), sanitizeHtml(b.intro_html ?? src?.intro_html ?? DEFAULT_INTRO), sanitizeHtml(b.terms_html ?? src?.terms_html ?? DEFAULT_TERMS), String(b.footer ?? src?.footer ?? DEFAULT_FOOTER).slice(0, 500), b.include_logo === false ? 0 : 1, 0, now(), now());
    res.status(201).json(db.prepare("SELECT * FROM doc_templates WHERE id=?").get(id)); });
  app.patch("/api/doc-templates/:id", requireAuth, settingsGuard, (req: any, res: any) => { const b = req.body || {}; const cur = db.prepare("SELECT * FROM doc_templates WHERE id=? AND workspace_id=?").get(req.params.id, ws(req)) as any; if (!cur) return err(res, 404, "not found");
    if (b.is_default) db.prepare("UPDATE doc_templates SET is_default=0 WHERE workspace_id=?").run(ws(req));
    const newDefault = b.is_default === undefined ? cur.is_default : (b.is_default ? 1 : 0);
    db.prepare("UPDATE doc_templates SET name=?, intro_html=?, terms_html=?, footer=?, include_logo=?, is_default=?, updated_at=? WHERE id=?")
      .run((b.name ?? cur.name).slice(0, 120), sanitizeHtml(b.intro_html ?? cur.intro_html), sanitizeHtml(b.terms_html ?? cur.terms_html), String(b.footer ?? cur.footer).slice(0, 500), b.include_logo === undefined ? cur.include_logo : (b.include_logo ? 1 : 0), newDefault, now(), req.params.id);
    res.json(db.prepare("SELECT * FROM doc_templates WHERE id=?").get(req.params.id)); });
  app.delete("/api/doc-templates/:id", requireAuth, settingsGuard, (req: any, res: any) => { const rows = db.prepare("SELECT id, is_default FROM doc_templates WHERE workspace_id=?").all(ws(req)) as any[]; if (rows.length <= 1) return err(res, 422, "Keep at least one template");
    const gone = rows.find(r => r.id === req.params.id); db.prepare("DELETE FROM doc_templates WHERE id=? AND workspace_id=?").run(req.params.id, ws(req));
    if (gone?.is_default) { const rest = db.prepare("SELECT id FROM doc_templates WHERE workspace_id=? ORDER BY created_at").get(ws(req)) as any; if (rest) db.prepare("UPDATE doc_templates SET is_default=1 WHERE id=?").run(rest.id); }
    res.json({ ok: true }); });
}

// ---------- v6: home command-center aggregate (article pattern: signals + agent state, assembled) ----------
export function registerHome(app: any, requireAuth: any) {
  app.get("/api/finances", requireAuth, (req: any, res: any) => { res.json(financialSummary(req.user.workspace_id)); });
  app.get("/api/home", requireAuth, (req: any, res: any) => {
    const w = req.user.workspace_id;
    // 30-day activity series (every lead event = work happening)
    const series: any[] = [];
    const rows = db.prepare("SELECT date(created_at) d, COUNT(*) c FROM lead_events WHERE workspace_id=? AND created_at>=date('now','-29 days') GROUP BY d").all(w) as any[];
    const byD = new Map(rows.map(r => [r.d, r.c]));
    for (let i = 29; i >= 0; i--) { const dt = new Date(Date.now() - i * 86400000); const key = dt.toISOString().slice(0, 10); series.push({ day: key, label: dt.toLocaleDateString(undefined, { month: "short", day: "numeric" }), count: byD.get(key) || 0 }); }
    // Agenda (v18): -14d..+14d window, every scheduled thing — tasks, callbacks, crew
    // schedule, follow-ups, SITE VISITS, invoice due dates, document + proposal expiries.
    const from = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10); const to = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10); const up: any[] = [];
    for (const t of db.prepare("SELECT t.*, l.service_requested, c.name contact_name FROM tasks t LEFT JOIN leads l ON l.id=t.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE t.workspace_id=? AND t.status='open' AND date(t.due_at) BETWEEN date(?) AND date(?)").all(w, from, to) as any[]) up.push({ date: String(t.due_at).slice(0, 10), kind: "task", title: t.title, sub: t.contact_name || "", lead_id: t.lead_id, task_id: t.id });
    for (const cb of db.prepare("SELECT cb.*, l.service_requested, ct.name contact_name FROM callbacks cb JOIN leads l ON l.id=cb.lead_id LEFT JOIN contacts ct ON ct.id=l.contact_id WHERE cb.workspace_id=? AND cb.status='open' AND date(cb.due_at) BETWEEN date(?) AND date(?)").all(w, from, to) as any[]) up.push({ date: String(cb.due_at).slice(0, 10), kind: "callback", title: "Callback — " + (cb.contact_name || cb.service_requested), sub: cb.service_requested || "", lead_id: cb.lead_id });
    for (const s of db.prepare("SELECT js.*, l.service_requested, c.name contact_name, COALESCE(wk.name, u.name) worker FROM job_schedule js JOIN leads l ON l.id=js.lead_id LEFT JOIN contacts c ON c.id=l.contact_id LEFT JOIN workers wk ON wk.id=js.worker_id LEFT JOIN users u ON u.id=js.user_id WHERE js.workspace_id=? AND date(js.work_date) BETWEEN date(?) AND date(?)").all(w, from, to) as any[]) up.push({ date: String(s.work_date).slice(0, 10), kind: "schedule", title: `${s.worker || "Crew"} on site`, sub: `${s.contact_name || ""} — ${s.service_requested || ""}`, lead_id: s.lead_id });
    for (const f of db.prepare("SELECT fe.*, l.service_requested, c.name contact_name FROM followup_enrollments fe JOIN leads l ON l.id=fe.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE fe.workspace_id=? AND fe.status='active' AND date(fe.next_due_at) BETWEEN date(?) AND date(?)").all(w, from, to) as any[]) up.push({ date: String(f.next_due_at).slice(0, 10), kind: "followup", title: `Follow-up step ${(f.step_idx || 0) + 1}`, sub: `${f.contact_name || ""} — ${f.service_requested || ""}`, lead_id: f.lead_id });
    for (const v of db.prepare("SELECT v.*, l.service_requested, c.name contact_name FROM site_visits v LEFT JOIN leads l ON l.id=v.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE v.workspace_id=? AND v.status='scheduled' AND date(v.scheduled_at) BETWEEN date(?) AND date(?)").all(w, from, to) as any[]) up.push({ date: String(v.scheduled_at).slice(0, 10), kind: "visit", title: "Site visit", sub: `${v.contact_name || ""} — ${v.service_requested || ""}`, lead_id: v.lead_id, time: String(v.scheduled_at).slice(11, 16) });
    for (const inv of db.prepare("SELECT i.*, j.lead_id FROM invoices i LEFT JOIN jobs j ON j.id=i.job_id WHERE i.workspace_id=? AND i.status IN ('sent','partially_paid') AND i.due_at IS NOT NULL AND date(i.due_at) BETWEEN date(?) AND date(?)").all(w, from, to) as any[]) up.push({ date: String(inv.due_at).slice(0, 10), kind: "invoice", title: `Invoice ${inv.number} due — $${Math.round((inv.total || 0) - (inv.paid_amount || 0)).toLocaleString()} open`, sub: "Collect before it ages", lead_id: inv.lead_id, job_id: inv.job_id });
    for (const doc of db.prepare("SELECT d.*, j.lead_id FROM documents d LEFT JOIN jobs j ON j.id=d.job_id WHERE d.workspace_id=? AND d.expires_at IS NOT NULL AND date(d.expires_at) BETWEEN date(?) AND date(?)").all(w, from, to) as any[]) up.push({ date: String(doc.expires_at).slice(0, 10), kind: "doc", title: `Document expires: ${doc.name}`, sub: "Renew before it lapses", lead_id: doc.lead_id, job_id: doc.job_id });
    for (const p of db.prepare("SELECT p.*, l.service_requested, c.name contact_name FROM proposals p JOIN leads l ON l.id=p.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE p.workspace_id=? AND p.status='sent' AND p.expires_at IS NOT NULL AND date(p.expires_at) BETWEEN date(?) AND date(?)").all(w, from, to) as any[]) up.push({ date: String(p.expires_at).slice(0, 10), kind: "expiry", title: "Proposal expires", sub: `${p.contact_name || ""} — ${p.service_requested || ""}`, lead_id: p.lead_id });
    up.sort((a, b) => a.date.localeCompare(b.date));
    const untouchedCount = (db.prepare("SELECT COUNT(*) c FROM leads WHERE workspace_id=? AND state='NEW' AND first_response_at IS NULL").get(w) as any).c;
    const recent = db.prepare("SELECT l.id, l.state, l.service_requested, l.est_value, l.ai_score, l.created_at, l.updated_at, c.name contact_name, u.name owner_name FROM leads l LEFT JOIN contacts c ON c.id=l.contact_id LEFT JOIN users u ON u.id=l.owner_id WHERE l.workspace_id=? AND l.state<>'DUPLICATE' ORDER BY l.created_at DESC LIMIT 8").all(w);
    const wrow = db.prepare("SELECT auto_score, auto_assign, auto_dedupe, auto_reactivate, last_automation_at FROM workspaces WHERE id=?").get(w) as any;
    const runs = (db.prepare("SELECT agent, output, created_at FROM agent_runs WHERE workspace_id=? ORDER BY created_at DESC LIMIT 6").all(w) as any[]).map(r => { let sum = ""; try { const o = JSON.parse(r.output); sum = Object.entries(o).filter(([, v]) => typeof v === "number" && (v as number) > 0).map(([k, v]) => `${k.replaceAll("_", " ")}: ${v}`).join(" · "); } catch { sum = String(r.output).slice(0, 90); } return { agent: r.agent, summary: sum || "no changes needed", created_at: r.created_at }; });
    const propWeek = (db.prepare("SELECT COUNT(*) c FROM proposals WHERE workspace_id=? AND created_at>=date('now','-7 days') AND status IN ('sent','signed','viewed')").get(w) as any).c;
    const propWeekAll = (db.prepare("SELECT COUNT(*) c FROM proposals WHERE workspace_id=? AND created_at>=date('now','-7 days')").get(w) as any).c;
    res.json({ activity_series: series, upcoming: up.slice(0, 200), untouched_count: untouchedCount, recently_assigned: recent, agent: { automations: wrow, runs, active_count: [wrow?.auto_score, wrow?.auto_assign, wrow?.auto_dedupe, wrow?.auto_reactivate].filter(Boolean).length }, proposals_sent_week: propWeek, proposals_built_week: propWeekAll, finances: financialSummary(w) });
  });
}

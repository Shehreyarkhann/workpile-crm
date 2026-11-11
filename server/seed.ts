// Demo seed — generic sample business (no real customer data). Run: node server/seed.ts
import { db, initSchema, uid, now, hashPassword, apiKeyHash } from "./db.ts";
initSchema();
const existing = db.prepare("SELECT id FROM workspaces LIMIT 1").get() as any;
if (existing) { console.log("Already seeded:", existing.id); process.exit(0); }
const ws = uid("ws");
db.prepare("INSERT INTO workspaces (id,name,vertical,created_at) VALUES (?,?,?,?)").run(ws, "Demo Environmental Services", "environmental", now());
const mkUser = (name: string, email: string, role: string, limit = 0) => { const id = uid("usr"); db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role,approval_limit) VALUES (?,?,?,?,?,?,?)").run(id, ws, name, email, hashPassword("demo1234"), role, limit); return id; };
const owner = mkUser("Olivia Owner", "owner@demo.test", "OWNER", 100000);
db.prepare("UPDATE users SET is_platform_admin=1 WHERE id=?").run(owner);
const approver = mkUser("Mike Manager", "manager@demo.test", "APPROVER", 25000);
const coord = mkUser("Sam Coordinator", "ops@demo.test", "OPS_ADMIN");
const leadOwner = mkUser("Laura Lead", "laura@demo.test", "LEAD_OWNER");
const pm = mkUser("Paul PM", "paul@demo.test", "PM");
const pm2 = mkUser("Priya PM", "priya@demo.test", "PM");
const svc = (name: string) => { const id = uid("svc"); db.prepare("INSERT INTO services (id,workspace_id,name) VALUES (?,?,?)").run(id, ws, name); return id; };
const sWater = svc("Water damage cleanup"), sMold = svc("Mold remediation"), sFire = svc("Fire & smoke restoration");
const pb = (service: string, name: string, price: number, floor: number) => { const id = uid("pb"); db.prepare("INSERT INTO price_book_items (id,workspace_id,service_id,name,unit,standard_price,floor_price) VALUES (?,?,?,?,?,?,?)").run(id, ws, service, name, "job", price, floor); return id; };
pb(sWater, "Water extraction & drying", 3200, 2600); pb(sWater, "Dehumidification (per day)", 450, 350);
pb(sMold, "Mold remediation — single room", 4800, 3900); pb(sFire, "Smoke & soot cleanup", 6500, 5200);
const tpl = uid("tpl"); db.prepare("INSERT INTO templates (id,workspace_id,service_id,kind,name,body) VALUES (?,?,?,?,?,?)").run(tpl, ws, sWater, "proposal", "Standard Proposal", "Scope: {{scope}}\nLine items from price book.\nTerms: Net 14, proposal valid 14 days.");
const key = "lf_demo_" + "testkey1234567890";
db.prepare("INSERT INTO api_keys (id,workspace_id,label,hashed_key,scopes) VALUES (?,?,?,?,?)").run(uid("key"), ws, "demo", apiKeyHash(key), "leads:write,leads:read,outcomes:read,projects:read");
console.log("Workspace:", ws); console.log("Demo logins: owner@demo.test / manager@demo.test / ops@demo.test — password demo1234");
console.log("Demo API key:", key);

// Sample leads across states (incl. backlog + unserviceable demand for Demand Gap)
const samples: any[] = [
  { name: "Jane Alvarez", phone: "+15165550101", email: "jane@example.com", service: "Water damage cleanup", value: 5400, state: "NEW", days: 1, msg: "Basement flooded yesterday, need help this week" },
  { name: "Tom Becker", phone: "+15165550102", email: "tom@example.com", service: "Mold remediation", value: 4800, state: "NEW", days: 45, msg: "Musty smell in bathroom, thinking mold" },
  { name: "Rita Chen", phone: "+15165550103", email: "rita@example.com", service: "Fire & smoke restoration", value: 12000, state: "WORKING", days: 3, msg: "Kitchen fire, smoke damage throughout first floor" },
  { name: "Omar Diaz", phone: "+15165550104", email: "omar@example.com", service: "Septic inspection", value: 900, state: "UNSERVICEABLE", days: 10, msg: "Do you do septic inspections?" },
  { name: "Kay Fox", phone: "+15165550105", email: "kay@example.com", service: "Septic inspection", value: 900, state: "UNSERVICEABLE", days: 20, msg: "Need a septic inspection before sale" },
  { name: "Leo Grant", phone: "+15165550106", email: "leo@example.com", service: "24/7 emergency cleanup", value: 3000, state: "UNSERVICEABLE", days: 5, msg: "Need emergency cleanup tonight" },
  { name: "Amy Hart", phone: "+15165550107", email: "amy@example.com", service: "Septic inspection", value: 900, state: "LOST", days: 30, msg: "Septic inspection quote", lost: "NOT_A_FIT" },
];
import("./app.ts").then(async () => {
  // create via direct inserts mirroring createLead's shape (seed is offline tooling)
  for (const s of samples) {
    const cid = uid("ct"); db.prepare("INSERT INTO contacts (id,workspace_id,name,phone,email) VALUES (?,?,?,?,?)").run(cid, ws, s.name, s.phone, s.email);
    const created = new Date(Date.now() - s.days * 86400000).toISOString();
    const id = uid("lead");
    db.prepare(`INSERT INTO leads (id,workspace_id,contact_id,dedupe_key,service_requested,state,urgency,value_band,est_value,owner_id,pm_id,approver_id,next_action,next_action_due_at,notes,location,lost_reason,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, ws, cid, s.phone.replace(/\D/g, ""), s.service, s.state, "this_week", s.value >= 10000 ? "high" : "medium", s.value, leadOwner, pm, approver, "First contact", new Date(Date.now() + 86400000).toISOString(), s.msg, "Bay Shore, NY", s.lost || null, created, now());
    if (["UNSERVICEABLE", "LOST"].includes(s.state)) {
      const { createHash } = await import("node:crypto");
      db.prepare("INSERT INTO outcome_deliveries (id,workspace_id,lead_id,outcome,payload_hash,last_status,created_at) VALUES (?,?,?,?,?,?,?)").run(uid("dlv"), ws, id, s.state === "LOST" ? "lost" : "na_unserviceable", createHash("sha256").update(id).digest("hex").slice(0, 16), "pending", now());
    }
  }
  // Field reports / timesheets (§25 P0-1)
  for (const [mgr, st] of [[pm, "submitted"], [pm2, "missing"]] as const) {
    db.prepare("INSERT INTO field_reports (id,workspace_id,manager_id,report_date,status,submitted_at) VALUES (?,?,?,?,?,?)").run(uid("fr"), ws, mgr, new Date().toISOString().slice(0, 10), st, st === "submitted" ? now() : null);
    db.prepare("INSERT INTO timesheets (id,workspace_id,manager_id,week_of,status,hours) VALUES (?,?,?,?,?,?)").run(uid("ts"), ws, mgr, new Date().toISOString().slice(0, 10), st, st === "submitted" ? 40 : null);
  }
  console.log("Seed complete.");
});

// Scale demo — ~2,600 leads incl ~2,000 won, to prove the UX at real volume.
// Run after seed.ts (+ demo-rich.ts) against the same DB: node server/demo-scale.ts
import { db, uid, now } from "./db.ts";
const ws = (db.prepare("SELECT id FROM workspaces LIMIT 1").get() as any).id;
const users = db.prepare("SELECT * FROM users WHERE workspace_id=?").all(ws) as any[];
const owners = users.filter(u => ["LEAD_OWNER", "OWNER", "PM"].includes(u.role));
const first = ["James", "Maria", "Robert", "Susan", "David", "Angela", "Michael", "Sarah", "Kevin", "Laura", "Brian", "Nicole", "Chris", "Amanda", "Steven", "Jessica", "Mark", "Emily", "Daniel", "Karen"];
const last = ["Smith", "Johnson", "Brown", "Garcia", "Miller", "Davis", "Wilson", "Moore", "Taylor", "Anderson", "Thomas", "Lee", "Walker", "Hall", "Allen", "Young", "King", "Wright", "Scott", "Torres"];
const services = ["Water damage cleanup", "Mold remediation", "Fire & smoke restoration", "Water damage cleanup", "Mold remediation", "Roofing replacement", "Sewer backup cleanup", "Storm damage repair"];
const plan: [string, number][] = [["WON", 2000], ["LOST", 220], ["NEW", 90], ["UNSERVICEABLE", 60], ["QUALIFYING", 60], ["NO_RESPONSE", 40], ["TRIAGED", 40], ["JUNK", 30], ["QUALIFIED", 30], ["PROPOSAL_SENT", 25], ["ON_HOLD", 5]];
const insC = db.prepare("INSERT INTO contacts (id,workspace_id,name,phone,email) VALUES (?,?,?,?,?)");
const insL = db.prepare(`INSERT INTO leads (id,workspace_id,contact_id,dedupe_key,service_requested,state,urgency,value_band,est_value,owner_id,pm_id,approver_id,next_action,next_action_due_at,first_response_at,notes,location,lost_reason,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
let n = 0;
const tx = db.prepare("BEGIN"); tx.run();
try {
  for (const [state, count] of plan) {
    for (let i = 0; i < count; i++) {
      n++;
      const name = first[n % 20] + " " + last[(n * 7) % 20];
      const phone = "+1516" + String(2000000 + n);
      const cid = uid("ct"); insC.run(cid, ws, name, phone, name.toLowerCase().replace(" ", ".") + n + "@example.com");
      const svc = services[n % services.length];
      const val = 800 + ((n * 137) % 27000);
      const created = new Date(Date.now() - ((n * 53) % 90) * 86400000 - (n % 23) * 3600000).toISOString();
      const updated = state === "WON" ? new Date(Date.now() - ((n * 31) % 14) * 86400000).toISOString() : created;
      insL.run(uid("lead"), ws, cid, phone.replace(/\D/g, ""), svc, state, n % 9 === 0 ? "emergency" : "this_week", val > 10000 ? "high" : val > 3000 ? "medium" : "low", val,
        owners[n % owners.length].id, users.find(u => u.role === "PM")?.id || null, users.find(u => u.role === "APPROVER")?.id || null,
        state === "NEW" ? "First contact" : "Follow up", new Date(Date.now() + (n % 5 - 2) * 86400000).toISOString(), created, "Scale demo lead #" + n, "Long Island, NY", state === "LOST" ? (n % 3 ? "PRICE" : "TIMING") : state === "UNSERVICEABLE" ? "OUT_OF_AREA" : null, created, updated);
    }
  }
  db.prepare("COMMIT").run();
} catch (e) { db.prepare("ROLLBACK").run(); throw e; }
console.log("SCALE DEMO READY:", n, "leads inserted (2,000 WON)");

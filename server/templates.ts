// Vertical template packs (target Decision F / §15): a new workspace starts from its
// trade's shape — services, price-book skeleton (prices at 0: the business sets its own),
// and lead custom fields. Applying a pack is idempotent by name/key.
export const VERTICAL_PACKS: any[] = [
  { id: "environmental", name: "Environmental Services", services: ["Phase I ESA", "Phase II ESA", "Asbestos Surveys", "Mold Testing", "Lead-Based Paint Surveys", "UST Removal Oversight", "Tank Testing", "Vapor Intrusion Assessment", "Petroleum Bulk Storage Compliance", "Remediation Oversight"], fields: [{ key: "property_type", label: "Property type" }, { key: "tank_count", label: "Tank count" }] },
  { id: "plumbing-hvac", name: "Plumbing & HVAC", services: ["Drain Cleaning", "Water Heater Install", "Sewer Line Inspection", "HVAC Tune-Up", "Furnace Replacement", "AC Repair", "Leak Detection"], fields: [{ key: "equipment_age", label: "Equipment age" }, { key: "warranty_status", label: "Warranty status" }] },
  { id: "roofing", name: "Roofing", services: ["Roof Inspection", "Shingle Replacement", "Flat Roof Repair", "Gutter Install", "Storm Damage Assessment", "Roof Coating"], fields: [{ key: "roof_age", label: "Roof age" }, { key: "roof_material", label: "Roof material" }] },
  { id: "restoration", name: "Restoration & Remediation", services: ["Water Extraction", "Structural Drying", "Mold Remediation", "Fire Damage Cleanup", "Contents Pack-Out", "Odor Removal"], fields: [{ key: "claim_number", label: "Insurance claim #" }, { key: "adjuster", label: "Adjuster" }] },
];

// Production readiness check — run before launch: node deploy/check-env.mjs
const checks = [];
const has = k => !!process.env[k];
checks.push(["STRIPE_SECRET_KEY (live deposits/subscriptions)", has("STRIPE_SECRET_KEY")]);
checks.push(["STRIPE_WEBHOOK_SECRET (signed webhooks)", has("STRIPE_WEBHOOK_SECRET")]);
checks.push(["STRIPE_PRICE_* (3 plan prices)", ["STRIPE_PRICE_STARTER","STRIPE_PRICE_GROWTH","STRIPE_PRICE_PRO"].every(has)]);
checks.push(["GOOGLE OAuth app (Gmail ingestion)", has("GOOGLE_CLIENT_ID") && has("GOOGLE_CLIENT_SECRET")]);
checks.push(["MS OAuth app (Outlook ingestion)", has("MS_CLIENT_ID") && has("MS_CLIENT_SECRET")]);
for (const [name, ok] of checks) console.log(`${ok ? "✅" : "⚠️  NOT SET"} ${name}`);
console.log("\nCore app runs without these; each ⚠️ is a feature that stays in its honest test/not-configured mode until set.");

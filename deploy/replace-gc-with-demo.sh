#!/usr/bin/env bash
# One-time ops: DELETE the G.C. Environmental workspace + its only-home users
# (scripts/wipe-gc-workspace.mjs — platform-admin cascade mirror), then create
# the fictional "Apex Environmental Services" demo workspace with a small team
# and working data in every stage (scripts/seed-demo-account.mjs).
# Stops the service while both run, then restarts + health-checks.
# Does NOT touch ClaimPaid, Workpile HQ, or any other workspace.
set -uo pipefail
APP_DIR="/opt/workpile"
cd "$APP_DIR" || { echo "!! $APP_DIR missing"; exit 1; }

echo "== Pulling latest (gets the wipe + demo seed scripts)"
git pull --ff-only || { echo "!! git pull failed"; exit 1; }

echo "== Stopping workpile service"
systemctl stop workpile

echo "== Deleting G.C. Environmental workspace + its users"
node scripts/wipe-gc-workspace.mjs
RC=$?
if [ "$RC" != "0" ]; then
  echo "!! Delete failed (see above) — workspace unchanged (transaction rolled back). Restarting service."
  systemctl start workpile
  exit 1
fi

echo "== Seeding Apex Environmental Services demo workspace"
node scripts/seed-demo-account.mjs
RC=$?
if [ "$RC" != "0" ]; then
  echo "!! Demo seed failed (see above) — G.C. is deleted; the seed can be re-run alone after fixing. Restarting service."
  systemctl start workpile
  exit 1
fi

echo "== Restarting workpile service"
systemctl start workpile
for i in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:4173/api/health" >/dev/null 2>&1; then
    echo "== App healthy on 127.0.0.1:4173"
    break
  fi
  sleep 1
  [ "$i" = "20" ] && { echo "!! App did not answer health — check: journalctl -u workpile -n 50"; exit 1; }
done

echo "== DONE — G.C. deleted; Apex Environmental Services demo is live"
echo "== Demo logins (password ApexDemo-2026! for all): dana@ / marcus@ / elena@ / tommy@apexenv.example"

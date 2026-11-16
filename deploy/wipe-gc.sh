#!/usr/bin/env bash
# One-time ops: wipe the G.C. Environmental workspace from prod so it can be
# re-seeded clean (node scripts/seed-gc-pilot.mjs, run by the operator after).
# Stops the service for the seconds the cascade runs, then restarts + health-checks.
# Does NOT touch ClaimPaid or any other workspace.
set -uo pipefail
APP_DIR="/opt/workpile"
cd "$APP_DIR" || { echo "!! $APP_DIR missing"; exit 1; }

echo "== Pulling latest (gets scripts/wipe-gc-workspace.mjs)"
git pull --ff-only || { echo "!! git pull failed"; exit 1; }

echo "== Stopping workpile service"
systemctl stop workpile

echo "== Wiping G.C. Environmental workspace"
node scripts/wipe-gc-workspace.mjs
RC=$?

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

[ "$RC" != "0" ] && { echo "!! Wipe script failed (see above) — workspace unchanged (transaction rolled back)"; exit 1; }
echo "== WIPE DONE — G.C. workspace removed; ready for reseed"

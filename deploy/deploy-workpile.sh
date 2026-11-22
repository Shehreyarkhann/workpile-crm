#!/usr/bin/env bash
# Workpile pilot deploy — workpile.claimpaid.io on the ClaimPaid droplet.
# Self-contained (exports everything itself), idempotent, safe to re-run.
# Does NOT touch the ClaimPaid app, its directory, or its nginx vhosts.
set -uo pipefail

export DOMAIN="workpile.claimpaid.io"
export REPO_URL="https://github.com/Shehreyarkhann/workpile-crm.git"
export APP_DIR="/opt/workpile"
export PORT="4173"
export BASE_URL="https://workpile.claimpaid.io"
DROPLET_IP="147.182.218.81"

echo "== Workpile deploy: $DOMAIN -> $APP_DIR (port $PORT)"

# --- Node 24 (the app uses Node type-stripping) ---
NODE_MAJOR=$(node -v 2>/dev/null | sed 's/v\([0-9]*\).*/\1/' || echo 0)
if [ "${NODE_MAJOR:-0}" -lt 24 ]; then
  echo "== Installing Node 24 (found: $(node -v 2>/dev/null || echo none))"
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi
node -v

# --- Chromium (v91: inspection report PDFs render through headless Chrome) ---
if ! command -v chromium >/dev/null 2>&1 && ! command -v chromium-browser >/dev/null 2>&1 && ! command -v google-chrome >/dev/null 2>&1; then
  echo "== Installing Chromium for report PDFs (best effort)"
  apt-get update -y >/dev/null 2>&1 || true
  apt-get install -y chromium >/dev/null 2>&1 || apt-get install -y chromium-browser >/dev/null 2>&1 || echo "WARN: Chromium install failed — reports will generate as HTML until a Chromium binary exists"
fi

# --- Code ---
if [ -d "$APP_DIR/.git" ]; then
  echo "== Updating existing clone"
  git -C "$APP_DIR" pull --ff-only
else
  echo "== Cloning $REPO_URL"
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

# --- Env (write once; never clobber a tuned .env on re-runs) ---
if [ ! -f .env ]; then
  cat > .env <<EOF
PORT=$PORT
BASE_URL=$BASE_URL
LEADFLOW_DB=$APP_DIR/data/leadflow.db
EOF
  echo "== Wrote fresh .env (pilot: Stripe/Resend/Twilio left blank = honest test mode)"
else
  echo "== Keeping existing .env"
fi
mkdir -p "$APP_DIR/data"

# --- Build ---
npm ci --no-fund --no-audit
npm run build

# --- systemd service ---
cat > /etc/systemd/system/workpile.service <<EOF
[Unit]
Description=Workpile (pilot on workpile.claimpaid.io)
After=network.target

[Service]
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
ExecStart=$(command -v node) server/index.ts
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable workpile >/dev/null 2>&1 || true
systemctl restart workpile

# --- Health (local) ---
for i in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
    echo "== App healthy on 127.0.0.1:$PORT"
    break
  fi
  sleep 1
  [ "$i" = "20" ] && { echo "!! App did not answer health — check: journalctl -u workpile -n 50"; exit 1; }
done

# --- Nightly DB backup (v116: the audit gap — backup.sh existed but nothing ever ran it) ---
# sqlite3 CLI gives backup.sh the online .backup path (safe against the live DB);
# without it the script falls back to cp, which can miss WAL contents.
if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "== Installing sqlite3 for backups (best effort)"
  apt-get install -y sqlite3 >/dev/null 2>&1 || echo "WARN: sqlite3 install failed — backups will use the cp fallback"
fi
chmod +x "$APP_DIR/deploy/backup.sh"
mkdir -p "$APP_DIR/backups"
# Cron: 3:17 AM America/New_York nightly, pinned via CRON_TZ so the droplet's own
# timezone doesn't matter. backup.sh resolves paths from env, so both are absolute
# here — a relative LEADFLOW_DB would silently back up the wrong file.
CRON_TZ_LINE="CRON_TZ=America/New_York"
CRON_LINE="17 3 * * * cd $APP_DIR && LEADFLOW_DB=$APP_DIR/data/leadflow.db BACKUP_DIR=$APP_DIR/backups $APP_DIR/deploy/backup.sh >> $APP_DIR/backups/backup.log 2>&1"
( crontab -l 2>/dev/null | grep -v "deploy/backup.sh" | grep -v "^CRON_TZ=America/New_York" ; echo "$CRON_TZ_LINE" ; echo "$CRON_LINE" ) | crontab -
echo "== Nightly backup cron installed (03:17 America/New_York, 14-day retention)"
# Run one backup right now and verify it, so a broken backup never waits for 3 AM to surface.
( cd "$APP_DIR" && LEADFLOW_DB="$APP_DIR/data/leadflow.db" BACKUP_DIR="$APP_DIR/backups" bash deploy/backup.sh ) || echo "WARN: initial backup run failed"
LATEST_BAK=$(ls -t "$APP_DIR/backups"/leadflow-*.db 2>/dev/null | head -1 || true)
if [ -n "$LATEST_BAK" ] && command -v sqlite3 >/dev/null 2>&1; then
  BAK_INTEGRITY=$(sqlite3 "$LATEST_BAK" "PRAGMA integrity_check;" | head -1)
  BAK_TABLES=$(sqlite3 "$LATEST_BAK" "SELECT count(*) FROM sqlite_master WHERE type='table';")
  echo "== Backup verified: $LATEST_BAK (integrity: $BAK_INTEGRITY, tables: $BAK_TABLES)"
elif [ -n "$LATEST_BAK" ]; then
  echo "== Backup written: $LATEST_BAK (sqlite3 absent — integrity check skipped)"
else
  echo "!! No backup file produced — investigate before trusting the cron"
fi

# --- nginx vhost (additive: its own server block, ClaimPaid untouched) ---
cat > /etc/nginx/sites-available/workpile <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
ln -sf /etc/nginx/sites-available/workpile /etc/nginx/sites-enabled/workpile
nginx -t && systemctl reload nginx
echo "== nginx vhost live for $DOMAIN"

# --- HTTPS (only once DNS points at this droplet) ---
RESOLVED=$(getent hosts "$DOMAIN" | awk '{print $1}' | head -1 || true)
if [ "$RESOLVED" = "$DROPLET_IP" ]; then
  if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect; then
    echo "== HTTPS certificate issued for $DOMAIN"
  else
    echo "!! certbot failed — app is live on HTTP; re-run this script to retry HTTPS"
  fi
else
  echo "!! DNS for $DOMAIN resolves to '${RESOLVED:-nothing}', not $DROPLET_IP — add the Cloudflare A record, then re-run this script for HTTPS"
fi

echo "== DONE. Verify: https://$DOMAIN/api/health"

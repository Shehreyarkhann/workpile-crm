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

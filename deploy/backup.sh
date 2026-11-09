#!/bin/bash
# Nightly SQLite backup with 14-day retention (age-encrypt before off-box copy in prod)
set -euo pipefail
DB="${LEADFLOW_DB:-data/leadflow.db}"; DIR="${BACKUP_DIR:-backups}"; mkdir -p "$DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
sqlite3 "$DB" ".backup '$DIR/leadflow-$STAMP.db'" 2>/dev/null || cp "$DB" "$DIR/leadflow-$STAMP.db"
find "$DIR" -name "leadflow-*.db" -mtime +14 -delete
echo "Backup written: $DIR/leadflow-$STAMP.db"

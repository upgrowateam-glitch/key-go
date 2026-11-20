#!/usr/bin/env bash
# KeyGo nightly backup: database + uploaded files (+ GPS data) → encrypted copy in Google Drive.
#
#   Database  : a full compressed dump every night; the last 7 are kept on the VPS, the last 14 in Drive.
#   Files     : only new or changed files are uploaded; a file deleted in KeyGo stays in Drive 14 more days.
#   Encryption: everything goes through the rclone "crypt" remote KEYGO_REMOTE, so Google only sees scrambled data.
#
# Reads DB_PORT and DB_PASSWORD from /opt/keygo/deploy/.env. Touches only KeyGo's containers and volumes.
# Run by cron (see README.md); run by hand with:  bash /opt/keygo/deploy/backup/keygo-backup.sh
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/keygo/deploy}"
LOCAL_DIR="${LOCAL_DIR:-/opt/keygo-backups}"
KEYGO_REMOTE="${KEYGO_REMOTE:-keygo-backup:}"   # rclone crypt remote (wraps the Google Drive folder KeyGo-Backups)
KEEP_LOCAL_DAYS=7
KEEP_REMOTE_DAYS=14
STAMP="$(date +%Y-%m-%d_%H%M)"
TODAY="$(date +%Y-%m-%d)"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# One backup at a time
exec 9>"${LOCK_FILE:-/var/lock/keygo-backup.lock}"
if ! flock -n 9; then
  log "Another backup is still running; skipping."
  exit 0
fi

# Settings from the deploy .env (only the two values we need)
DB_PORT="$(grep -E '^DB_PORT=' "$DEPLOY_DIR/.env" | tail -1 | cut -d= -f2-)"
DB_PASSWORD="$(grep -E '^DB_PASSWORD=' "$DEPLOY_DIR/.env" | tail -1 | cut -d= -f2-)"
if [ -z "$DB_PORT" ] || [ -z "$DB_PASSWORD" ]; then
  log "ERROR: DB_PORT or DB_PASSWORD missing in $DEPLOY_DIR/.env"
  exit 1
fi

command -v rclone >/dev/null || { log "ERROR: rclone is not installed (see README.md)"; exit 1; }
rclone listremotes | grep -qx "${KEYGO_REMOTE%%:*}:" || { log "ERROR: rclone remote ${KEYGO_REMOTE%%:*} is not set up (see README.md)"; exit 1; }

mkdir -p "$LOCAL_DIR/db"
chmod 700 "$LOCAL_DIR"

# ---------------------------------------------------------------- 1. database
DUMP="$LOCAL_DIR/db/keygo-$STAMP.dump"
log "Dumping the database…"
docker exec -e PGPASSWORD="$DB_PASSWORD" keygo-db \
  pg_dump -h 127.0.0.1 -p "$DB_PORT" -U keygo -d keygo --format=custom --compress=9 > "$DUMP.part"
mv "$DUMP.part" "$DUMP"
chmod 600 "$DUMP"
log "Database dump: $(du -h "$DUMP" | cut -f1)"
find "$LOCAL_DIR/db" -name 'keygo-*.dump' -mtime +"$KEEP_LOCAL_DAYS" -delete

log "Uploading database dumps…"
rclone copy "$LOCAL_DIR/db" "${KEYGO_REMOTE}db" --include 'keygo-*.dump'
rclone delete "${KEYGO_REMOTE}db" --min-age "${KEEP_REMOTE_DAYS}d"

# ---------------------------------------------------------------- 2. uploaded files (photos, documents, signatures)
volume_dir() { docker volume inspect -f '{{ .Mountpoint }}' "$1" 2>/dev/null || true; }

FILES_DIR="$(volume_dir keygo_keygo-storage)"
if [ -n "$FILES_DIR" ] && [ -d "$FILES_DIR" ]; then
  log "Uploading new and changed files…"
  rclone sync "$FILES_DIR" "${KEYGO_REMOTE}files" --backup-dir "${KEYGO_REMOTE}files-deleted/$TODAY"
  rclone delete "${KEYGO_REMOTE}files-deleted" --min-age "${KEEP_REMOTE_DAYS}d"
  rclone rmdirs "${KEYGO_REMOTE}files-deleted" --leave-root || true
else
  log "WARNING: volume keygo_keygo-storage not found; files skipped"
fi

# ---------------------------------------------------------------- 3. GPS data (Traccar), if it is running
GPS_DIR="$(volume_dir keygo_keygo-traccar-data)"
if [ -n "$GPS_DIR" ] && [ -d "$GPS_DIR" ]; then
  log "Uploading GPS data…"
  rclone sync "$GPS_DIR" "${KEYGO_REMOTE}gps" --backup-dir "${KEYGO_REMOTE}gps-deleted/$TODAY"
  rclone delete "${KEYGO_REMOTE}gps-deleted" --min-age "${KEEP_REMOTE_DAYS}d"
  rclone rmdirs "${KEYGO_REMOTE}gps-deleted" --leave-root || true
fi

log "Backup finished."

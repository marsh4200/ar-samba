#!/usr/bin/env bash
# Snapshot SambaControl's database and .env into $INSTALL_DIR/backups/data-<ts>.tar.gz
# Run via cron or manually:  sudo /opt/sambacontrol/scripts/backup.sh
set -Eeuo pipefail

INSTALL_DIR="/opt/sambacontrol"
BACKUP_ROOT="${INSTALL_DIR}/backups"
TS=$(date -u +%Y%m%d-%H%M%S)
OUT="${BACKUP_ROOT}/data-${TS}.tar.gz"

mkdir -p "$BACKUP_ROOT"
tar -czf "$OUT" \
    -C "$INSTALL_DIR" \
    data .env 2>/dev/null

echo "backup written: $OUT"

# Retain only the last 10 data snapshots
ls -1t "${BACKUP_ROOT}"/data-*.tar.gz 2>/dev/null | tail -n +11 | xargs -r rm --

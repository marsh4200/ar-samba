#!/usr/bin/env bash
# Restore a database+env snapshot produced by backup.sh.
# Usage: sudo /opt/sambacontrol/scripts/restore.sh /opt/sambacontrol/backups/data-YYYYMMDD-HHMMSS.tar.gz
set -Eeuo pipefail

INSTALL_DIR="/opt/sambacontrol"
SRC="${1:-}"
[[ $EUID -eq 0 ]] || { echo "run as root" >&2; exit 1; }
[[ -n "$SRC" && -f "$SRC" ]] || { echo "usage: restore.sh <backup.tar.gz>" >&2; exit 2; }

echo "==> Stopping backend"
systemctl stop sambacontrol-backend || true

echo "==> Restoring from $SRC"
tar -xzf "$SRC" -C "$INSTALL_DIR"
chown -R sambacontrol:sambacontrol "${INSTALL_DIR}/data" "${INSTALL_DIR}/.env"

echo "==> Starting backend"
systemctl start sambacontrol-backend
echo "==> Restore complete."

#!/usr/bin/env bash
# Restore the most recent SambaControl snapshot from $INSTALL_DIR/backups.
set -Eeuo pipefail

INSTALL_DIR="/opt/sambacontrol"
BACKUP_ROOT="${INSTALL_DIR}/backups"

[[ $EUID -eq 0 ]] || { echo "run as root" >&2; exit 1; }

# Either use .last_backup pointer (set by update.sh), or pick newest dir.
if [[ -f "${INSTALL_DIR}/.last_backup" ]]; then
    SNAP=$(cat "${INSTALL_DIR}/.last_backup")
else
    SNAP=$(ls -1dt "${BACKUP_ROOT}"/2* 2>/dev/null | head -n1 || true)
fi

if [[ -z "${SNAP:-}" || ! -d "$SNAP" ]]; then
    echo "no snapshot to roll back to" >&2
    exit 1
fi

echo "==> Restoring ${SNAP}"
rsync -a --delete \
      --exclude="data/" --exclude="backups/" --exclude=".env" \
      "${SNAP}/" "${INSTALL_DIR}/"

systemctl restart sambacontrol-backend || true
echo "==> Rolled back."

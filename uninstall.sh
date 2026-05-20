#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────
#  Remove SambaControl.
#  Safe by default: keeps the Samba install, your shares on disk, and your
#  Samba users alone. Only removes the SambaControl service, code, sudoers,
#  and managed include file.
#
#  Flags:
#    --purge          Also remove $INSTALL_DIR (DB, .env, backups)
#    --remove-users   Also delete every SambaControl-managed user (DANGEROUS)
# ──────────────────────────────────────────────────────────────────────────
set -Eeuo pipefail

INSTALL_DIR="/opt/sambacontrol"
PURGE=0
REMOVE_USERS=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --purge) PURGE=1; shift ;;
        --remove-users) REMOVE_USERS=1; shift ;;
        -h|--help)
            sed -n '2,15p' "$0"; exit 0 ;;
        *) echo "Unknown arg: $1" >&2; exit 2 ;;
    esac
done

[[ $EUID -eq 0 ]] || { echo "run as root" >&2; exit 1; }

step() { echo "==> $*"; }

step "Stopping services"
systemctl disable --now sambacontrol-backend 2>/dev/null || true

step "Removing systemd unit"
rm -f /etc/systemd/system/sambacontrol-backend.service
systemctl daemon-reload

step "Removing nginx site"
rm -f /etc/nginx/sites-enabled/sambacontrol /etc/nginx/sites-available/sambacontrol
nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null || true

step "Removing sudoers rule"
rm -f /etc/sudoers.d/sambacontrol

step "Removing managed Samba include"
# Don't touch shares the user might still need; just stop including ours.
sed -i '/# Added by SambaControl/,/include = \/etc\/samba\/sambacontrol.conf/d' /etc/samba/smb.conf 2>/dev/null || true
rm -f /etc/samba/sambacontrol.conf
testparm -s /etc/samba/smb.conf >/dev/null 2>&1 && systemctl reload smbd 2>/dev/null || true

if (( REMOVE_USERS )); then
    step "Removing managed Samba users (because --remove-users was set)"
    if [[ -f "${INSTALL_DIR}/data/sambacontrol.db" ]]; then
        # Pull usernames from the sqlite DB and delete them
        for u in $(sqlite3 "${INSTALL_DIR}/data/sambacontrol.db" \
                   "SELECT username FROM samba_users;" 2>/dev/null); do
            echo "    - removing $u"
            smbpasswd -x "$u" 2>/dev/null || true
            userdel "$u" 2>/dev/null || true
        done
    fi
fi

if (( PURGE )); then
    step "Removing $INSTALL_DIR (purge)"
    rm -rf "$INSTALL_DIR"
    userdel sambacontrol 2>/dev/null || true
else
    echo "    (kept ${INSTALL_DIR} — pass --purge to remove the DB and .env)"
fi

echo
echo "✓ SambaControl uninstalled."
echo "  Samba itself is still installed; remove with: sudo apt purge samba samba-common-bin"

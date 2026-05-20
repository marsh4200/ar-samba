#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────
#  SambaControl recovery + GUI-update script.
#
#  Pulls latest code, repairs venv if missing, refreshes unit + sudoers
#  + nginx, rebuilds frontend, and schedules a deferred restart.
#
#  Safe to run as a CHILD of sambacontrol-backend (the GUI uses it that
#  way) because the restart is deferred via systemd-run, preventing
#  parent-process-suicide.
#
#  Usage:
#    sudo bash /opt/sambacontrol/scripts/fix.sh
#    OR via GUI Settings → Updates → Update Now
# ──────────────────────────────────────────────────────────────────────────
set -Eeuo pipefail

INSTALL_DIR=/opt/sambacontrol
UNIT=/etc/systemd/system/sambacontrol-backend.service
SUDOERS=/etc/sudoers.d/sambacontrol
SHARES_ROOT=/srv/samba/shares

say()  { echo "==> $*"; }
ok()   { echo "    ✓ $*"; }
fail() { echo "✗ $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || fail "run as root:  sudo bash scripts/fix.sh"
[[ -d "$INSTALL_DIR" ]] || fail "$INSTALL_DIR not found — run install.sh first"

# IMPORTANT: do NOT stop the backend here. When invoked from the GUI we are
# a child of sambacontrol-backend; stopping it would kill us mid-run.

# Recover .git if missing
if [[ ! -d "$INSTALL_DIR/.git" ]]; then
    say "Repairing missing .git"
    git config --global --add safe.directory "$INSTALL_DIR" 2>/dev/null || true
    cd "$INSTALL_DIR"
    git init -b main >/dev/null
    git remote add origin https://github.com/marsh4200/ar-samba.git
    git fetch --quiet origin
    git reset --quiet --hard origin/main
    cd - >/dev/null
    ok ".git restored"
fi

say "Pulling latest from GitHub"
git config --global --add safe.directory "$INSTALL_DIR" 2>/dev/null || true
GIT_TERMINAL_PROMPT=0 git -C "$INSTALL_DIR" fetch --quiet origin
git -C "$INSTALL_DIR" reset --quiet --hard origin/main
ok "repo up to date ($(cat "$INSTALL_DIR/VERSION"))"

# Recover venv if missing
if [[ ! -x "$INSTALL_DIR/venv/bin/python" ]]; then
    say "Rebuilding Python venv"
    rm -rf "$INSTALL_DIR/venv"
    PY=""
    for cand in python3.12 python3.11 python3.10 python3; do
        if command -v "$cand" >/dev/null 2>&1; then
            mj=$($cand -c 'import sys;print(sys.version_info[0])')
            mn=$($cand -c 'import sys;print(sys.version_info[1])')
            if (( mj > 3 )) || { (( mj == 3 )) && (( mn >= 10 )); }; then
                PY=$(command -v "$cand"); break
            fi
        fi
    done
    [[ -n "$PY" ]] || fail "no suitable python3 found — re-run install.sh"
    "$PY" -m venv "$INSTALL_DIR/venv"
    "$INSTALL_DIR/venv/bin/pip" install --quiet --upgrade pip wheel
    "$INSTALL_DIR/venv/bin/pip" install --quiet -r "$INSTALL_DIR/backend/requirements.txt"
    ok "venv rebuilt with $($PY --version)"
fi

# Always update Python deps (cheap if already current)
say "Updating Python deps"
"$INSTALL_DIR/venv/bin/pip" install --quiet --upgrade pip wheel
"$INSTALL_DIR/venv/bin/pip" install --quiet -r "$INSTALL_DIR/backend/requirements.txt"
ok "venv up to date"

# Scripts must be executable
chmod +x "$INSTALL_DIR"/install.sh "$INSTALL_DIR"/update.sh \
         "$INSTALL_DIR"/uninstall.sh "$INSTALL_DIR"/scripts/*.sh 2>/dev/null || true

say "Installing fresh systemd unit"
install -m 0644 -o root -g root \
    "$INSTALL_DIR/installer/sambacontrol-backend.service" "$UNIT"
ok "$UNIT updated"

say "Installing fresh sudoers allowlist"
install -m 0440 -o root -g root \
    "$INSTALL_DIR/installer/sudoers.d/sambacontrol" "$SUDOERS"
visudo -c -f "$SUDOERS" >/dev/null || fail "sudoers syntax check failed"
ok "$SUDOERS updated (syntax OK)"

say "Installing fresh nginx site"
install -m 0644 -o root -g root \
    "$INSTALL_DIR/installer/nginx-sambacontrol.conf" \
    /etc/nginx/sites-available/sambacontrol
ln -sf /etc/nginx/sites-available/sambacontrol /etc/nginx/sites-enabled/sambacontrol
nginx -t >/dev/null && systemctl reload nginx
ok "nginx refreshed"

say "Rebuilding frontend (clean install)"
pushd "$INSTALL_DIR/frontend" >/dev/null
rm -rf node_modules package-lock.json dist
npm install --no-audit --no-fund --loglevel=error
[[ -f node_modules/vite/dist/node/cli.js ]] || fail "vite install incomplete (likely OOM)"
npm run build
[[ -f dist/index.html ]] || fail "frontend build produced no dist/index.html"
popd >/dev/null
ok "frontend rebuilt"

say "Ensuring shares root exists"
mkdir -p "$SHARES_ROOT"
getent group users >/dev/null || groupadd users
chown root:users "$SHARES_ROOT"
chmod 2775 "$SHARES_ROOT"
ok "$SHARES_ROOT ready"

if command -v ufw >/dev/null 2>&1; then
    UFW_STATE=$(ufw status 2>/dev/null | head -1 | awk '{print $2}')
    if [[ "$UFW_STATE" == "active" ]]; then
        ufw allow 9912/tcp comment 'SambaControl GUI' >/dev/null 2>&1 || true
        ufw allow Samba >/dev/null 2>&1 || true
        ok "ufw: 9912/tcp + Samba allowed"
    fi
fi

say "Fixing ownership"
chown -R sambacontrol:sambacontrol "$INSTALL_DIR"
[[ -f "$INSTALL_DIR/.env" ]] && chmod 600 "$INSTALL_DIR/.env"

# Daemon-reload is fine — doesn't kill us
say "Reloading systemd"
systemctl daemon-reload
ok "daemon reloaded"

# DEFERRED restart — runs 5s after this script exits, so we don't suicide.
# Whether invoked from SSH or from the GUI (where backend is our parent),
# this is safe.
say "Scheduling backend restart (in 5 seconds)"
systemd-run --quiet --on-active=5s --unit=sambacontrol-restart-once \
    /bin/systemctl restart sambacontrol-backend
ok "backend will restart shortly"

HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "<server-ip>")
cat <<MSG

╔════════════════════════════════════════════════════════════════╗
║   Update / recovery complete                                   ║
╚════════════════════════════════════════════════════════════════╝

   Web UI: http://${HOST_IP}:9912
   Version: $(cat "$INSTALL_DIR/VERSION")

   Backend restarts in ~5 seconds.
   Then hard-refresh your browser (Ctrl+Shift+R).

MSG

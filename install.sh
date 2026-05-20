#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────
#  SambaControl one-line installer
#  Repo:    https://github.com/marsh4200/ar-samba
#  Targets: Ubuntu Server 20.04, 22.04, 24.04 (any release with Python 3.10+
#           available; older versions get python3.11 from deadsnakes PPA)
#  Usage:
#    curl -fsSL https://raw.githubusercontent.com/marsh4200/ar-samba/main/install.sh | sudo bash
#  OR:
#    curl -fsSLO https://raw.githubusercontent.com/marsh4200/ar-samba/main/install.sh && sudo bash install.sh
# ──────────────────────────────────────────────────────────────────────────
set -Eeuo pipefail

REPO="${SAMBACONTROL_REPO:-marsh4200/ar-samba}"
BRANCH="${SAMBACONTROL_BRANCH:-main}"
INSTALL_DIR="/opt/sambacontrol"
DATA_DIR="${INSTALL_DIR}/data"
BACKUP_DIR="${INSTALL_DIR}/backups"
LOG_DIR="/var/log/sambacontrol"
SHARES_ROOT="/srv/samba/shares"
SERVICE_USER="sambacontrol"
SERVICE_GROUP="sambacontrol"
WEB_PORT=9912
API_PORT=9913
PY_MIN_MAJOR=3
PY_MIN_MINOR=10

BOLD=$(tput bold 2>/dev/null || true)
DIM=$(tput dim 2>/dev/null || true)
RED=$(tput setaf 1 2>/dev/null || true)
GRN=$(tput setaf 2 2>/dev/null || true)
YLW=$(tput setaf 3 2>/dev/null || true)
BLU=$(tput setaf 4 2>/dev/null || true)
RST=$(tput sgr0 2>/dev/null || true)

step()    { echo -e "${BOLD}${BLU}==>${RST} ${BOLD}$*${RST}"; }
info()    { echo -e "    ${DIM}$*${RST}"; }
ok()      { echo -e "    ${GRN}✓${RST} $*"; }
warn()    { echo -e "    ${YLW}!${RST} $*"; }
fail()    { echo -e "${BOLD}${RED}✗${RST} ${BOLD}$*${RST}" >&2; exit 1; }

trap 'echo; fail "Installer failed at line $LINENO. Check ${LOG_DIR}/install.log."' ERR

[[ $EUID -eq 0 ]] || fail "Run as root:  sudo bash install.sh   (or pipe via | sudo bash)"

if [[ -f /etc/os-release ]]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    [[ "${ID:-}" == "ubuntu" ]] || warn "Detected '${ID:-unknown}' — tested on Ubuntu only, but may work elsewhere."
fi

mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/install.log"
touch "$LOG_FILE"
exec > >(tee -a "$LOG_FILE") 2>&1

cat <<'BANNER'

   ╔═══════════════════════════════════════════════════════╗
   ║            S a m b a C o n t r o l                    ║
   ║      Self-hosted Samba + ACL management               ║
   ║      github.com/marsh4200/ar-samba                    ║
   ╚═══════════════════════════════════════════════════════╝

BANNER

# ---- 1. system deps -------------------------------------------------------
step "Installing system dependencies"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq

# NOTE: omit 'npm' here — both Ubuntu nodejs and NodeSource nodejs include npm,
# and listing npm separately breaks if NodeSource is the source (conflict).
apt-get install -y --no-install-recommends \
    samba samba-common-bin acl \
    python3 python3-venv python3-pip python3-dev \
    nginx \
    git curl ca-certificates \
    sudo nodejs \
    rsync jq sqlite3 \
    software-properties-common \
    build-essential libffi-dev libssl-dev
ok "apt packages installed"

# ---- 1a. Python — autodetect a 3.10+ interpreter --------------------------
PYTHON_BIN=""
for cand in python3.12 python3.11 python3.10 python3; do
    if command -v "$cand" >/dev/null 2>&1; then
        mj=$($cand -c 'import sys;print(sys.version_info[0])' 2>/dev/null || echo 0)
        mn=$($cand -c 'import sys;print(sys.version_info[1])' 2>/dev/null || echo 0)
        if (( mj > PY_MIN_MAJOR )) || { (( mj == PY_MIN_MAJOR )) && (( mn >= PY_MIN_MINOR )); }; then
            PYTHON_BIN=$(command -v "$cand")
            break
        fi
    fi
done

if [[ -z "$PYTHON_BIN" ]]; then
    warn "No Python ${PY_MIN_MAJOR}.${PY_MIN_MINOR}+ found — installing python3.11 from deadsnakes PPA"
    add-apt-repository -y ppa:deadsnakes/ppa
    apt-get update -qq
    apt-get install -y --no-install-recommends python3.11 python3.11-venv python3.11-dev
    PYTHON_BIN=$(command -v python3.11)
fi
ok "$("$PYTHON_BIN" --version) at $PYTHON_BIN"

# ---- 1b. Node ≥ 18 (and ensure npm is present) ----------------------------
NODE_MAJ=$(node -e 'console.log(process.versions.node.split(".")[0])' 2>/dev/null || echo 0)
if (( NODE_MAJ < 18 )); then
    warn "Node ${NODE_MAJ} too old — installing NodeSource 20.x"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
if ! command -v npm >/dev/null; then
    apt-get install -y --no-install-recommends npm
fi
ok "node $(node -v), npm $(npm -v)"

# ---- 2. service user ------------------------------------------------------
step "Creating service account '${SERVICE_USER}'"
if id -u "$SERVICE_USER" >/dev/null 2>&1; then
    ok "user already exists"
else
    useradd --system --home "$INSTALL_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
    ok "user created"
fi
getent group users >/dev/null || groupadd users

# ---- 3. fetch source ------------------------------------------------------
step "Fetching SambaControl sources"
git config --global --add safe.directory "$INSTALL_DIR" 2>/dev/null || true

if [[ -d "$INSTALL_DIR/.git" ]]; then
    git -C "$INSTALL_DIR" fetch --quiet origin
    git -C "$INSTALL_DIR" reset --quiet --hard "origin/${BRANCH}"
    ok "updated existing checkout"
else
    rm -rf "$INSTALL_DIR.tmp"
    git clone --quiet --depth 1 --branch "$BRANCH" "https://github.com/${REPO}.git" "$INSTALL_DIR.tmp"
    if [[ -d "$INSTALL_DIR" ]]; then
        [[ -d "$INSTALL_DIR/data"    ]] && mv "$INSTALL_DIR/data"    "$INSTALL_DIR.tmp/data"
        [[ -d "$INSTALL_DIR/backups" ]] && mv "$INSTALL_DIR/backups" "$INSTALL_DIR.tmp/backups"
        [[ -f "$INSTALL_DIR/.env"    ]] && mv "$INSTALL_DIR/.env"    "$INSTALL_DIR.tmp/.env"
        rm -rf "$INSTALL_DIR"
    fi
    mv "$INSTALL_DIR.tmp" "$INSTALL_DIR"
    ok "cloned ${REPO}@${BRANCH}"
fi

# Scripts must be executable (the git tree may or may not preserve the bit)
chmod +x "$INSTALL_DIR"/install.sh "$INSTALL_DIR"/update.sh "$INSTALL_DIR"/uninstall.sh "$INSTALL_DIR"/scripts/*.sh 2>/dev/null || true

# ---- 4. directories -------------------------------------------------------
step "Preparing directories"
mkdir -p "$DATA_DIR" "$BACKUP_DIR" "$LOG_DIR" "$SHARES_ROOT"
chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "$INSTALL_DIR" "$DATA_DIR" "$BACKUP_DIR" "$LOG_DIR"
chown root:users "$SHARES_ROOT"
chmod 2775 "$SHARES_ROOT"
ok "directories ready"

# ---- 5. python venv -------------------------------------------------------
step "Setting up Python virtualenv ($("$PYTHON_BIN" --version))"
"$PYTHON_BIN" -m venv "$INSTALL_DIR/venv"
"$INSTALL_DIR/venv/bin/pip" install --quiet --upgrade pip wheel
"$INSTALL_DIR/venv/bin/pip" install --quiet -r "$INSTALL_DIR/backend/requirements.txt"
chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "$INSTALL_DIR/venv"
ok "venv populated"

# ---- 6. .env --------------------------------------------------------------
step "Generating environment file"
if [[ ! -f "$INSTALL_DIR/.env" ]]; then
    SECRET=$(openssl rand -hex 48)
    if [[ -f "$INSTALL_DIR/.env.example" ]]; then
        sed -e "s|change-me-with-openssl-rand-hex-48|${SECRET}|" \
            "$INSTALL_DIR/.env.example" > "$INSTALL_DIR/.env"
    else
        cat > "$INSTALL_DIR/.env" <<EOF
SAMBACONTROL_WEB_PORT=${WEB_PORT}
SAMBACONTROL_API_PORT=${API_PORT}
SAMBACONTROL_BIND_HOST=0.0.0.0
SAMBACONTROL_SECRET_KEY=${SECRET}
SAMBACONTROL_JWT_ALG=HS256
SAMBACONTROL_ACCESS_TOKEN_MINUTES=30
SAMBACONTROL_REFRESH_TOKEN_DAYS=14
SAMBACONTROL_DATABASE_URL=sqlite:////opt/sambacontrol/data/sambacontrol.db
SAMBACONTROL_SHARES_ROOT=${SHARES_ROOT}
SAMBACONTROL_SMB_CONF=/etc/samba/smb.conf
SAMBACONTROL_SMB_INCLUDE=/etc/samba/sambacontrol.conf
SAMBACONTROL_GITHUB_REPO=${REPO}
SAMBACONTROL_INSTALL_DIR=${INSTALL_DIR}
SAMBACONTROL_BACKUP_DIR=${BACKUP_DIR}
SAMBACONTROL_LOG_LEVEL=INFO
SAMBACONTROL_LOG_DIR=${LOG_DIR}
EOF
    fi
    chmod 600 "$INSTALL_DIR/.env"
    chown "${SERVICE_USER}:${SERVICE_GROUP}" "$INSTALL_DIR/.env"
    ok "wrote .env (secret key generated)"
else
    info "preserving existing .env"
fi

# ---- 7. frontend build ----------------------------------------------------
step "Building frontend"
pushd "$INSTALL_DIR/frontend" >/dev/null
rm -rf node_modules package-lock.json dist
npm install --no-audit --no-fund --loglevel=error --cache=/tmp/npm-cache
[[ -f node_modules/vite/dist/node/cli.js ]] || fail "vite install incomplete (likely OOM during npm install)"
npm run build
[[ -f dist/index.html ]] || fail "frontend build produced no dist/index.html"
popd >/dev/null
chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "$INSTALL_DIR/frontend"
ok "frontend built"

# ---- 8. samba config ------------------------------------------------------
step "Configuring Samba"
SMB_CONF="/etc/samba/smb.conf"
SMB_INCLUDE="/etc/samba/sambacontrol.conf"

if [[ ! -f "$SMB_INCLUDE" ]]; then
    cat > "$SMB_INCLUDE" <<'EOF'
# === SambaControl managed file ===
# Edited automatically — do not modify by hand.
EOF
    chmod 0644 "$SMB_INCLUDE"
fi

if ! grep -qE "^[[:space:]]*include[[:space:]]*=[[:space:]]*${SMB_INCLUDE}" "$SMB_CONF" 2>/dev/null; then
    {
        echo ""
        echo "# Added by SambaControl"
        echo "include = ${SMB_INCLUDE}"
    } >> "$SMB_CONF"
    ok "added include directive to smb.conf"
else
    ok "include directive already present"
fi

if testparm -s "$SMB_CONF" >/dev/null 2>&1; then
    ok "smb.conf validated by testparm"
else
    fail "smb.conf failed testparm validation — refusing to continue"
fi

# ---- 9. sudoers -----------------------------------------------------------
step "Installing restricted sudoers rule"
install -m 0440 -o root -g root \
    "$INSTALL_DIR/installer/sudoers.d/sambacontrol" \
    /etc/sudoers.d/sambacontrol
visudo -c -f /etc/sudoers.d/sambacontrol >/dev/null
ok "/etc/sudoers.d/sambacontrol installed"

# ---- 10. systemd unit -----------------------------------------------------
step "Installing systemd unit"
install -m 0644 -o root -g root \
    "$INSTALL_DIR/installer/sambacontrol-backend.service" \
    /etc/systemd/system/sambacontrol-backend.service
systemctl daemon-reload
systemctl enable --now sambacontrol-backend
ok "sambacontrol-backend running"

# ---- 11. nginx ------------------------------------------------------------
step "Configuring nginx"
install -m 0644 -o root -g root \
    "$INSTALL_DIR/installer/nginx-sambacontrol.conf" \
    /etc/nginx/sites-available/sambacontrol
ln -sf /etc/nginx/sites-available/sambacontrol /etc/nginx/sites-enabled/sambacontrol
[[ -L /etc/nginx/sites-enabled/default ]] && rm /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
ok "nginx serving on :${WEB_PORT}"

# ---- 12. samba services ---------------------------------------------------
step "Enabling Samba services"
systemctl enable --now smbd nmbd
ok "smbd + nmbd running"

# ---- 12a. firewall --------------------------------------------------------
if command -v ufw >/dev/null 2>&1; then
    UFW_STATE=$(ufw status 2>/dev/null | head -1 | awk '{print $2}')
    if [[ "$UFW_STATE" == "active" ]]; then
        step "Configuring firewall (ufw)"
        ufw allow "${WEB_PORT}/tcp" comment 'SambaControl GUI' >/dev/null 2>&1 || true
        ufw allow Samba >/dev/null 2>&1 || true
        ok "ufw: ${WEB_PORT}/tcp + Samba allowed"
    fi
fi

# ---- 13. health probe -----------------------------------------------------
step "Verifying installation"
sleep 2
if curl -fsS "http://127.0.0.1:${API_PORT}/api/health" >/dev/null; then
    ok "backend reachable on :${API_PORT}"
else
    fail "backend health probe failed (port ${API_PORT})"
fi
if curl -fsS "http://127.0.0.1:${WEB_PORT}/api/health" >/dev/null; then
    ok "nginx proxy reachable on :${WEB_PORT}"
else
    warn "nginx proxy did not respond — check 'systemctl status nginx'"
fi

# ---- 14. live sudo test (uses an actually-allowlisted command) -----------
step "Verifying backend can run sudo commands"
if sudo -u sambacontrol sudo -n /usr/bin/mkdir -p /srv/samba/shares/.installtest 2>/dev/null; then
    rmdir /srv/samba/shares/.installtest 2>/dev/null || true
    ok "sudo works for the service user"
else
    warn "sudo test failed — run: sudo bash $INSTALL_DIR/scripts/fix.sh"
fi

# ---- 15. summary ----------------------------------------------------------
HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "<server-ip>")

cat <<EOF

${BOLD}${GRN}╔═════════════════════════════════════════════════════════════╗
║   SambaControl installed successfully                       ║
╚═════════════════════════════════════════════════════════════╝${RST}

   ${BOLD}Web UI:${RST}   http://${HOST_IP}:${WEB_PORT}
   ${BOLD}API:${RST}      http://${HOST_IP}:${WEB_PORT}/api/docs

   Open the URL above and complete the first-run setup wizard.

   ${BOLD}Files:${RST}
     Install dir:   ${INSTALL_DIR}
     Shares root:   ${SHARES_ROOT}
     Logs:          journalctl -u sambacontrol-backend

   ${BOLD}Updating:${RST}
     From the GUI: Settings → Updates → Update Now
     From CLI:     sudo ${INSTALL_DIR}/update.sh

EOF

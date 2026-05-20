#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────
#  SambaControl updater — v0.5.1 design
#
#  Does NOT stop the backend (the GUI runs this script AS the backend's
#  child process — stopping the backend would kill update.sh itself).
#  SQLite handles concurrent access via WAL + busy_timeout.
#
#  Usage:
#    sudo /opt/sambacontrol/update.sh                  # update to latest
#    sudo /opt/sambacontrol/update.sh --version 0.5.1  # specific tag
# ──────────────────────────────────────────────────────────────────────────
set -Eeuo pipefail

INSTALL_DIR=/opt/sambacontrol
BACKUP_ROOT=${INSTALL_DIR}/backups
BRANCH=${SAMBACONTROL_BRANCH:-main}
TARGET_VERSION=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --version) TARGET_VERSION="$2"; shift 2 ;;
        --branch)  BRANCH="$2"; shift 2 ;;
        *) echo "Unknown arg: $1"; exit 2 ;;
    esac
done

say()  { echo "==> $*"; }
ok()   { echo "    ✓ $*"; }
warn() { echo "    ! $*"; }
fail() { echo "ERROR: $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || fail "run as root"
[[ -d "$INSTALL_DIR/.git" ]] || fail "$INSTALL_DIR is not a git checkout — run install.sh first"
[[ -x "$INSTALL_DIR/venv/bin/python" ]] || fail "venv missing — run scripts/fix.sh first"

TS=$(date -u +%Y%m%d-%H%M%S)
BACKUP_DIR=${BACKUP_ROOT}/${TS}
mkdir -p "$BACKUP_ROOT"

snapshot() {
    say "Snapshotting current install → ${BACKUP_DIR}"
    mkdir -p "$BACKUP_DIR"
    git -C "$INSTALL_DIR" rev-parse HEAD > "$BACKUP_DIR/git-head" 2>/dev/null || \
        echo "unknown" > "$BACKUP_DIR/git-head"
    cp "$INSTALL_DIR/VERSION" "$BACKUP_DIR/VERSION" 2>/dev/null || true
    ok "snapshot written"
}

rollback() {
    local prev_head
    prev_head=$(cat "$BACKUP_DIR/git-head" 2>/dev/null || echo "")
    warn "ROLLING BACK"
    if [[ -n "$prev_head" && "$prev_head" != "unknown" ]]; then
        git -C "$INSTALL_DIR" reset --hard "$prev_head" 2>/dev/null || warn "git reset failed"
        chmod +x "$INSTALL_DIR"/install.sh "$INSTALL_DIR"/update.sh \
                 "$INSTALL_DIR"/uninstall.sh "$INSTALL_DIR"/scripts/*.sh 2>/dev/null || true
        warn "code reverted to ${prev_head:0:8}"
    fi
    exit 1
}
trap 'rollback' ERR

snapshot

# ---- 1. Pull code --------------------------------------------------------
say "Fetching latest from origin/${BRANCH}"
git config --global --add safe.directory "$INSTALL_DIR" 2>/dev/null || true
GIT_TERMINAL_PROMPT=0 git -C "$INSTALL_DIR" fetch --quiet origin

if [[ -n "$TARGET_VERSION" ]]; then
    TAG="$TARGET_VERSION"
    [[ "$TAG" =~ ^v ]] || TAG="v${TAG}"
    GIT_TERMINAL_PROMPT=0 git -C "$INSTALL_DIR" fetch --quiet --tags origin
    git -C "$INSTALL_DIR" checkout --quiet "$TAG"
    ok "checked out $TAG"
else
    git -C "$INSTALL_DIR" reset --quiet --hard "origin/${BRANCH}"
    ok "fast-forwarded to origin/${BRANCH}"
fi

chmod +x "$INSTALL_DIR"/install.sh "$INSTALL_DIR"/update.sh \
         "$INSTALL_DIR"/uninstall.sh "$INSTALL_DIR"/scripts/*.sh 2>/dev/null || true

NEW_VERSION=$(cat "$INSTALL_DIR/VERSION" 2>/dev/null || echo unknown)
say "Installing v${NEW_VERSION}"

# ---- 2. Python deps ------------------------------------------------------
say "Updating Python dependencies"
"$INSTALL_DIR/venv/bin/pip" install --quiet --upgrade pip wheel
"$INSTALL_DIR/venv/bin/pip" install --quiet -r "$INSTALL_DIR/backend/requirements.txt"
ok "venv up to date"

# ---- 3. Frontend (full clean install every time) -------------------------
say "Rebuilding frontend"
pushd "$INSTALL_DIR/frontend" >/dev/null
rm -rf node_modules package-lock.json dist
npm install --no-audit --no-fund --loglevel=error
[[ -f node_modules/vite/dist/node/cli.js ]] || fail "vite install incomplete (likely OOM)"
npm run build
[[ -f dist/index.html ]] || fail "frontend build produced no dist/index.html"
popd >/dev/null
ok "frontend rebuilt"

# ---- 4. Migrations (SQLite WAL + busy_timeout handle concurrency) -------
say "Running migrations"
pushd "$INSTALL_DIR/backend" >/dev/null
"$INSTALL_DIR/venv/bin/python" -c "from app.core.database import init_db; init_db()"
popd >/dev/null
ok "schema applied"

# ---- 5. Ownership --------------------------------------------------------
chown -R sambacontrol:sambacontrol \
      "$INSTALL_DIR/backend" \
      "$INSTALL_DIR/frontend/dist" \
      "$INSTALL_DIR/frontend/node_modules" \
      "$INSTALL_DIR/venv" \
      "$INSTALL_DIR/scripts" \
      "$INSTALL_DIR/installer" \
      "$INSTALL_DIR/VERSION" 2>/dev/null || true

# ---- 6. Schedule a deferred restart ---------------------------------------
# We CAN'T `systemctl restart sambacontrol-backend` directly because we ARE
# a child of sambacontrol-backend (the GUI launched us). systemd would kill
# us along with the parent. Instead schedule a one-shot transient unit that
# runs the restart 5 seconds from now, AFTER this script has exited.
say "Scheduling deferred restart"
systemd-run --quiet --on-active=5s --unit=sambacontrol-restart-once \
    /bin/systemctl restart sambacontrol-backend
ok "backend will restart in 5 seconds"

# ---- 7. Prune old snapshots (keep last 5) --------------------------------
say "Cleaning up old snapshots"
mapfile -t OLD < <(ls -1dt "${BACKUP_ROOT}"/2* 2>/dev/null | tail -n +6 || true)
for d in "${OLD[@]}"; do
    rm -rf -- "$d"
done
ok "kept the 5 most recent snapshots"

trap - ERR
say "Update to v${NEW_VERSION} complete — backend restarting"

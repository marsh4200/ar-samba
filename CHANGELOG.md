# Changelog

## v0.3.0 — 2026-05-20

**Compatibility**

- Now supports Ubuntu 20.04, 22.04, and 24.04 (autodetects Python 3.10+,
  installs python3.11 from deadsnakes PPA if needed)
- No longer conflicts with NodeSource nodejs (npm is no longer apt-installed
  separately)
- Installer now sets `safe.directory` for git so `sudo` cross-uid clones work

**Critical fixes**

- `update.sh` rollback no longer wipes `.git/`, `venv/`, or
  `frontend/node_modules/` (previously a failed update could destroy the install)
- `update.sh` now `cd`s into `backend/` before running migrations
  (fixed `ModuleNotFoundError: No module named 'app'`)
- Scripts now stay executable after `git pull`
- systemd unit no longer enables seccomp-based hardening that implicitly blocks
  sudo (`SystemCallArchitectures`, `RestrictNamespaces`, `ProtectKernel*`,
  `NoNewPrivileges`, `RestrictSUIDSGID`, `MemoryDenyWriteExecute`,
  `LockPersonality`, `ProtectSystem=full`)
- Sudoers allowlist now permits `update.sh`'s actual commands:
  `systemctl restart sambacontrol-backend`, `systemctl daemon-reload`,
  `systemctl reload nginx`, `nginx -t`, `visudo -c -f`
- Backend `stream_run` now raises on non-zero exit, so the GUI updater
  modal correctly shows "failed" instead of falsely reporting success
- `install.sh` and `fix.sh` sudo tests use `/usr/bin/mkdir` (allowlisted)
  instead of `/bin/true` (not allowlisted, falsely reported sudo as broken)

**UX**

- ACL editor: user dropdown now fetches a fresh list every time the dialog
  opens (previously stuck with stale user list from page-mount, so users
  created after the page first loaded didn't appear)
- Installer opens UFW (`9912/tcp` + `Samba`) automatically if UFW is active
- `scripts/fix.sh` recovery script now repairs missing `.git` and `venv`,
  rebuilds the frontend, and runs a real allowlisted sudo test
- README uses `curl ... | sudo bash` (works with all shells, unlike
  `sudo bash <(...)` which fails on shells without `/dev/fd`)

## v0.1.0 — 2026-05-19

Initial release.

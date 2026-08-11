# Changelog

## v2.0.0 — 2026-08-11

A full redesign of the web interface. **No existing API, backend behaviour or
feature was changed or removed** — every endpoint keeps its original contract.

**New design system**

- Layered deep-navy surfaces (`#070A12` / `#0B0F1A` / `#111726`) with a
  cyan-to-azure signal ramp, replacing the previous flat indigo-on-black theme
- Type pairing: Space Grotesk (wordmark, headings, metrics), Inter (UI),
  JetBrains Mono (paths, usernames, log actions)
- New AR Samba brand mark and wordmark; matching favicon and boot splash
- Reusable primitives: `Button`, `Card`, `Badge`, `Field`, `Table`, `Dialog`,
  `Switch`, `Progress`, `Gauge`, `StatCard`, `Segmented`, `DropdownMenu`,
  `Skeleton`, `PageHeader`, `EmptyState`
- Reduced-motion support and a consistent keyboard focus ring throughout

**Layout**

- Collapsible sidebar with grouped navigation; the collapse preference persists
- Live CPU/RAM rail and Samba status pinned to the bottom of the sidebar
- Off-canvas mobile drawer with scroll lock and Escape-to-close
- Sticky topbar with storage readout, service status and an account menu
- Fully responsive from 390px through desktop

**Screens**

- **Dashboard** — segmented arc gauges for CPU, memory and storage; status
  cards; services panel; volume capacity; recent-activity feed
- **Shares** — searchable table, access badges, row action menus, and a
  rebuilt permissions editor with Read only / Add files / Full control presets
- **Users** — avatars, status filter with counts, inline enable/disable
- **Activity** — category filters, failure banner, expandable error details,
  live mode, and "Load older" using the API's existing `limit`/`offset`
- **Settings** — sectioned layout with a sticky page index; stepper controls
  for the timeout settings; redesigned updater with a step preview
- **Login / first-run setup** — split-screen layout with password strength

**Added**

- `GET /api/system/metrics` — live CPU, memory, load and uptime via the
  already-vendored `psutil`. Purely additive; the frontend degrades gracefully
  when talking to an older backend that doesn't expose it.
- Tests covering the new endpoint and asserting the dashboard payload contract
  is unchanged

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

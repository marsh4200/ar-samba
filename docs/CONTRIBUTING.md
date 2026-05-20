# Contributing

Thanks for taking the time to contribute. SambaControl tries to be a tight,
focused project — a few patterns to know.

---

## Repo layout

See [README.md](../README.md#-project-structure).

---

## Dev environment

You can work on the backend with the Samba commands stubbed:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run with system commands simulated, sqlite in-cwd, no log dir requirement
export SAMBACONTROL_DEV_MODE=true
export SAMBACONTROL_DATABASE_URL="sqlite:///./dev.db"
export SAMBACONTROL_LOG_DIR="./logs"
export SAMBACONTROL_BACKUP_DIR="./backups"
export SAMBACONTROL_INSTALL_DIR="$(pwd)/.."
export SAMBACONTROL_SHARES_ROOT="/tmp/sc-shares"
mkdir -p "$SAMBACONTROL_LOG_DIR" "$SAMBACONTROL_BACKUP_DIR" "$SAMBACONTROL_SHARES_ROOT"

uvicorn app.main:app --reload --port 9913
```

Frontend:

```bash
cd frontend
npm install
npm run dev   # serves :5173 and proxies /api to localhost:9913
```

In DEV_MODE, every `sudo` command is *logged but not executed*, so you can
exercise the API without messing with your real Samba install.

---

## Coding conventions

**Python**
- Type hints on every function signature
- Pydantic models for every API boundary
- All shell-outs through `app.services.runner.run` — never `os.system` or
  `subprocess.run` directly
- All user-supplied paths through `validators.resolve_share_path`
- All user-supplied names through `validators.validate_username`
  / `validate_share_name`

**JavaScript / React**
- Functional components only
- Use `@/` aliases (configured in `vite.config.js`)
- Toast notifications via `useToast()` for any user-triggered action
- No `localStorage` access outside `lib/api.js`

---

## Adding a new privileged command

Every new shell-out needs a matching `sudoers.d/sambacontrol` entry. The
sudoers file is regex-strict on purpose — wildcards like `/usr/bin/foo *`
must be path-pinned to a directory we own, not free-form. If you need to add
one:

1. Add a `Cmnd_Alias` to `installer/sudoers.d/sambacontrol`.
2. Add it to the final `sambacontrol ALL=(root) NOPASSWD: ...` line.
3. Document why in `docs/SECURITY.md`.
4. Validate with `visudo -c -f installer/sudoers.d/sambacontrol`.

---

## Releases & versioning

- `VERSION` is the single source of truth (semver, e.g. `0.2.0`)
- Tag releases with `v<VERSION>` (e.g. `v0.2.0`)
- The GUI updater pulls from GitHub Releases — push a release with notes
- The CI workflow at `.github/workflows/ci.yml` runs lint + tests on every PR

---

## Tests

A minimal test suite lives in `backend/tests/`. Run it with:

```bash
cd backend
pytest
```

Frontend tests aren't wired up yet — PRs welcome.

---

## Pull requests

- One concern per PR
- Update the relevant doc page if behaviour changes
- For privileged-command changes, include the sudoers diff in the PR description

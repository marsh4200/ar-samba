# Security Model

This document describes the assumptions, controls, and known limits of
SambaControl's security posture. Read it before exposing the GUI outside a
trusted network.

---

## Threat model

| Adversary | In scope? | Mitigations |
|-----------|-----------|-------------|
| Unauthenticated network attacker | ✅ | JWT-only API, no public endpoints except `/api/health`. First-run wizard is sealed once an admin exists. |
| Authenticated admin user | ⚠️ partial | Trusted by design. Actions are audited but not gated by a second factor. |
| Authenticated non-admin (viewer/operator) | ✅ | RBAC enforced server-side on every update endpoint. |
| Malicious Samba *end user* (someone with credentials to a managed share) | ✅ | Share access is restricted by Samba `valid users` + POSIX ACLs jailed to `shares_root`. They have no shell. |
| Compromised backend process | ⚠️ partial | Backend runs as `sambacontrol` (no shell). It can only `sudo` the commands in `/etc/sudoers.d/sambacontrol` — a tight allowlist of `smbpasswd`, `useradd`, `userdel`, `setfacl`, `mkdir/chown/chmod` (path-prefixed to shares root), `install` (target-prefixed to `/etc/samba`), `systemctl reload smbd`, and our two helper scripts. It cannot read other users' files, escalate to root shell, or execute arbitrary binaries. |
| Malicious release tag from GitHub | ❌ | Out of scope. We trust the upstream repository. Pin to a known-good tag and review `git diff` before applying in regulated environments. |

---

## Defence-in-depth controls

### 1. Process isolation
- Backend runs as the unprivileged `sambacontrol` system user (no shell, no home).
- systemd unit applies: `NoNewPrivileges`, `ProtectSystem=full`, `ProtectHome`,
  `PrivateTmp`, `MemoryDenyWriteExecute`, `LockPersonality`,
  `RestrictNamespaces`, `RestrictSUIDSGID`, `SystemCallArchitectures=native`.
- `ReadWritePaths` is constrained to `/opt/sambacontrol/data`,
  `/var/log/sambacontrol`, `/opt/sambacontrol/backups`, `/tmp`, `/etc/samba`.

### 2. Privilege boundary
- Every privileged action goes through `sudo` to a fixed command allowlist.
- The allowlist is in `/etc/sudoers.d/sambacontrol` and is parsed by `visudo`
  on every install/update — a malformed file is rejected and rolled back.
- No command in the allowlist accepts a free-form path; arguments are
  pattern-locked to `/srv/samba/shares*`, `/etc/samba/*`, etc.

### 3. Input validation
- All usernames must match `^[a-z_][a-z0-9_-]{0,31}$` and are checked against a
  reserved-name list (`root`, `daemon`, `bin`, `sys`, `nobody`, `sambacontrol`).
- All share names must match `^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$` and are checked
  against Samba reserved sections (`global`, `homes`, `printers`, `print$`).
- All share paths are resolved with `Path.resolve(strict=False)` and rejected
  unless they sit under `SAMBACONTROL_SHARES_ROOT`. Path components `..` and
  `~` are forbidden after resolution.

### 4. Command execution
- **`shell=True` is never used.** Every shell-out passes an `argv` list to
  `subprocess.run`.
- Every command has a finite timeout.
- Passwords are passed via stdin to `smbpasswd`, never on the command line
  (where they would land in `ps`).

### 5. Config writes
- The managed `smb.conf` include file is written to a temp path and validated
  with `testparm -s` *before* being installed into `/etc/samba/`.
- If validation fails, the move never happens — the running config is
  untouched.

### 6. Authentication
- Passwords hashed with bcrypt (`passlib`).
- JWTs are short-lived (30 min access tokens, 14 day refresh tokens).
- Login responses are deliberately generic ("Invalid credentials") to avoid
  username enumeration.
- The first-run setup wizard is sealed (`409 Conflict`) as soon as an admin
  exists.

### 7. Audit logging
- Every privileged action (`user.create`, `share.delete`, `acl.upsert`,
  `samba.reload`, `update.start`, etc.) is recorded in the `activity_log` table
  with actor, timestamp, target, status, and any error detail.
- Logs are queryable through `/api/logs` and visible on the **Activity** page.

### 8. ACL inheritance
- Permission grants apply both an access ACL and a default ACL by default
  (`setfacl -d`), so newly-created files inside a share automatically get the
  right permissions.
- Share directories are created `2770` (setgid + group RWX) so the owning
  group is preserved on new files.

---

## Known limits

- **No 2FA.** Admin login is single-factor. If the admin password leaks, an
  attacker with network access to 9912 gets full control. Mitigate by
  restricting 9912 at the firewall and rotating the admin password periodically.
- **No CSRF token.** The API is JWT-bearer-only and doesn't accept cookies, so
  CSRF doesn't apply in the classic sense — but if you embed the GUI in
  another origin via iframe, audit your reverse proxy's `X-Frame-Options`.
- **No rate limiting in-app.** Brute-force protection should be applied at
  the reverse proxy (`limit_req` in nginx, fail2ban, etc.). The
  installer-shipped nginx config does not enable this; tune for your
  environment.
- **SQLite by default.** Adequate for typical share counts (hundreds to low
  thousands). Migration to Postgres is straightforward — change
  `SAMBACONTROL_DATABASE_URL` and re-run the updater. Concurrent admins
  changing config simultaneously are still serialised by the backend's own
  locks; SQLite isn't the bottleneck.
- **Updater trusts GitHub.** If your supply chain requires it, pin a release
  tag and disable in-GUI updates by removing `SAMBACTL_UPDATE` from the
  sudoers allowlist.

---

## Reporting issues

If you find a security issue, **please don't open a public GitHub issue.**
Instead, email the maintainer or open a private security advisory on the
repository.

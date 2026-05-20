"""Samba management — smb.conf generation, user provisioning, service control.

Design:
* SambaControl owns a *single included file* (sambacontrol.conf) so we never
  mutate the user's hand-edited smb.conf except to add an `include = ...` line
  on first install.
* We validate every config write with `testparm -s` before reloading Samba.
* User provisioning creates `useradd -M -s /usr/sbin/nologin` accounts, then
  sets the smbpasswd via `pdbedit` / `smbpasswd -a` stdin.
"""
from __future__ import annotations

import logging
import tempfile
from dataclasses import dataclass
from pathlib import Path

from app.core.config import get_settings
from app.services.runner import CommandError, run

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# smb.conf generation
# ---------------------------------------------------------------------------

@dataclass
class ShareSpec:
    name: str
    path: str
    comment: str | None
    browseable: bool
    read_only: bool
    guest_ok: bool
    valid_users: list[str]


def render_include_file(shares: list[ShareSpec]) -> str:
    """Render the SambaControl-managed include file."""
    lines: list[str] = [
        "# === SambaControl managed file ===",
        "# DO NOT EDIT BY HAND — overwritten on every share change.",
        "",
    ]
    for s in shares:
        lines.append(f"[{s.name}]")
        if s.comment:
            lines.append(f"   comment = {s.comment}")
        lines.append(f"   path = {s.path}")
        lines.append(f"   browseable = {'yes' if s.browseable else 'no'}")
        lines.append(f"   read only = {'yes' if s.read_only else 'no'}")
        lines.append(f"   guest ok = {'yes' if s.guest_ok else 'no'}")
        if s.valid_users:
            lines.append(f"   valid users = {', '.join(s.valid_users)}")
        # Sensible defaults for Linux ACL integration
        lines.append("   create mask = 0660")
        lines.append("   directory mask = 0770")
        lines.append("   inherit acls = yes")
        lines.append("   inherit permissions = yes")
        lines.append("")
    return "\n".join(lines)


def write_smb_include(shares: list[ShareSpec]) -> None:
    """Atomically write the include file and validate before reload."""
    settings = get_settings()
    content = render_include_file(shares)

    # Write to temp, run testparm against a merged config, then move.
    with tempfile.NamedTemporaryFile("w", suffix=".conf", delete=False) as tmp:
        tmp.write(content)
        tmp_path = Path(tmp.name)

    try:
        # `testparm -s` on the include alone will warn about no [global] —
        # so we test by including it into a throwaway main file.
        check_main = tempfile.NamedTemporaryFile("w", suffix=".conf", delete=False)
        check_main.write(f"[global]\n   workgroup = WORKGROUP\n   security = user\n\ninclude = {tmp_path}\n")
        check_main.flush()
        check_main_path = Path(check_main.name)
        check_main.close()

        run(["testparm", "-s", str(check_main_path)], check=True, timeout=15)

        # Move into place (root-owned target — needs sudo)
        run(["install", "-m", "0644", str(tmp_path), str(settings.smb_include)], sudo=True)
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except OSError:
            pass

    _ensure_include_line()


def _ensure_include_line() -> None:
    """Make sure /etc/samba/smb.conf includes our managed file."""
    settings = get_settings()
    marker = f"include = {settings.smb_include}"
    try:
        current = Path(settings.smb_conf).read_text()
    except (FileNotFoundError, PermissionError):
        current = ""
    if marker in current:
        return
    appended = (current.rstrip() + f"\n\n# Added by SambaControl\n{marker}\n").lstrip()
    # Write through sudo
    with tempfile.NamedTemporaryFile("w", suffix=".conf", delete=False) as tmp:
        tmp.write(appended)
        tmp_path = Path(tmp.name)
    try:
        run(["install", "-m", "0644", str(tmp_path), str(settings.smb_conf)], sudo=True)
    finally:
        tmp_path.unlink(missing_ok=True)


def reload_samba() -> None:
    """Reload smbd + nmbd."""
    try:
        run(["systemctl", "reload", "smbd"], sudo=True)
    except CommandError:
        # Some distros only support restart for reload
        run(["systemctl", "restart", "smbd"], sudo=True)


def samba_service_status(unit: str) -> tuple[bool, str, int | None]:
    """Return (active, state-text, pid)."""
    r = run(["systemctl", "show", unit, "--no-page",
             "--property=ActiveState,SubState,MainPID"], check=False)
    props = {}
    for line in r.stdout.splitlines():
        if "=" in line:
            k, v = line.split("=", 1)
            props[k.strip()] = v.strip()
    active = props.get("ActiveState") == "active"
    state = f"{props.get('ActiveState', 'unknown')} ({props.get('SubState', '?')})"
    pid_raw = props.get("MainPID")
    pid = int(pid_raw) if pid_raw and pid_raw.isdigit() and pid_raw != "0" else None
    return active, state, pid


# ---------------------------------------------------------------------------
# Linux + Samba user provisioning
# ---------------------------------------------------------------------------

def create_system_user(username: str, password: str, display_name: str | None) -> None:
    """Create a no-shell Linux user and set its smbpasswd."""
    # 1. POSIX user, no home, no login shell
    gecos = display_name or username
    run(
        ["useradd", "-M", "-s", "/usr/sbin/nologin", "-c", gecos, username],
        sudo=True,
    )
    # 2. Lock the Linux password (we never use it for login)
    run(["passwd", "-l", username], sudo=True, check=False)
    # 3. Set the Samba password via smbpasswd stdin: "pw\npw\n"
    smb_set_password(username, password)


def smb_set_password(username: str, password: str) -> None:
    """Set or change a Samba user's password via smbpasswd stdin."""
    stdin = f"{password}\n{password}\n"
    run(["smbpasswd", "-a", "-s", username], sudo=True, input_text=stdin)


def smb_enable_user(username: str, enabled: bool) -> None:
    """Enable or disable a Samba user."""
    flag = "-e" if enabled else "-d"
    run(["smbpasswd", flag, username], sudo=True)


def delete_system_user(username: str) -> None:
    """Remove the user from Samba then from the OS. Idempotent."""
    run(["smbpasswd", "-x", username], sudo=True, check=False)
    run(["userdel", username], sudo=True, check=False)

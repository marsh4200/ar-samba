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
    settings = get_settings()
    lines: list[str] = [
        "# === SambaControl managed file ===",
        "# DO NOT EDIT BY HAND — overwritten on every share change.",
        "",
    ]
    # Global tunables that go in the [global] section. These are SAFE to
    # place in an included file because Samba merges them into the main
    # [global] block at config parse time.
    # Global tunables. These MUST be merged into the main [global] block, which
    # only happens if our `include =` line sits *inside* [global] in smb.conf
    # (handled by _ensure_include_line). We therefore do NOT open our own
    # [global] section here — doing so would NOT merge and Samba would ignore
    # `deadtime`. We emit the bare parameters first, before any share section,
    # so they belong to [global] when included from within it.
    dead = max(0, int(settings.smb_deadtime_minutes or 0))
    if dead > 0:
        lines.extend([
            "# Disconnect idle SMB sessions (with no open files) after N minutes.",
            f"deadtime = {dead}",
            "keepalive = 60",
            "",
        ])
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
        check_main.write(
            "[global]\n"
            "   workgroup = WORKGROUP\n"
            "   security = user\n"
            f"   include = {tmp_path}\n"
        )
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
    """Make sure /etc/samba/smb.conf includes our managed file *inside* [global].

    The include MUST live within the [global] section, otherwise global tunables
    in the managed file (e.g. `deadtime`) are not merged into Samba's global
    config and are silently ignored.
    """
    settings = get_settings()
    marker = f"include = {settings.smb_include}"
    try:
        current = Path(settings.smb_conf).read_text()
    except (FileNotFoundError, PermissionError):
        current = ""
    if marker in current:
        return

    lines = current.splitlines()
    out: list[str] = []
    inserted = False
    in_global = False
    for line in lines:
        stripped = line.strip()
        is_section = stripped.startswith("[") and stripped.endswith("]")
        # When we hit the start of any section after having entered [global],
        # insert our include just before leaving [global].
        if is_section and in_global and not inserted:
            out.append(f"   # Added by SambaControl")
            out.append(f"   {marker}")
            inserted = True
        out.append(line)
        if is_section:
            in_global = stripped.lower() == "[global]"

    # If [global] was the last section (no section after it), append inside it.
    if in_global and not inserted:
        out.append(f"   # Added by SambaControl")
        out.append(f"   {marker}")
        inserted = True

    # No [global] section at all — create one with the include.
    if not inserted:
        header = ["[global]", f"   # Added by SambaControl", f"   {marker}", ""]
        out = header + out

    appended = ("\n".join(out)).strip() + "\n"
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

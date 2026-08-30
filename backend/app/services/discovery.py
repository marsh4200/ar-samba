"""Discovery of Samba shares/users that exist outside SambaControl's database.

The scenario this exists for: Samba was set up by hand (smb.conf edited over
SSH, accounts added with `smbpasswd -a` / `pdbedit`) before SambaControl was
installed, or alongside it. SambaControl only knows what's in its own
database — this module asks *Samba itself* what it's currently serving
(`testparm -s`) and who it currently has in its password backend
(`pdbedit -L -v`), and reports anything that isn't tracked yet so it can be
adopted.

Design notes:
* We use `testparm -s` rather than hand-parsing smb.conf. That way include
  files, defaults, and Samba's own quirky config grammar are all resolved
  exactly the way smbd would resolve them — we just read the answer.
* Discovery never touches the filesystem. Only `adopt_share_section()`
  writes anything, and only smb.conf's own text (never share directories or
  ACLs — those stay exactly as they were before import).
"""
from __future__ import annotations

import logging
import re
import tempfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.share import Share
from app.models.user import SambaUser
from app.services.runner import CommandError, run

logger = logging.getLogger(__name__)

# Sections/services Samba manages itself — never candidates for import.
RESERVED_SECTIONS = {"global", "homes", "printers", "print$"}


@dataclass
class DiscoveredShare:
    name: str
    path: str
    comment: str | None = None
    browseable: bool = True
    read_only: bool = True
    guest_ok: bool = False
    valid_users: list[str] = field(default_factory=list)


@dataclass
class DiscoveredUser:
    username: str
    display_name: str | None = None
    enabled: bool = True


# --------------------------------------------------------------------------- parsing

def _yesno(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in ("yes", "true", "1")


def _parse_testparm_dump(text: str) -> dict[str, dict[str, str]]:
    """Parse `testparm -s` output into ``{section_name: {param: value}}``."""
    sections: dict[str, dict[str, str]] = {}
    current: str | None = None
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or line.startswith(";"):
            continue
        if line.startswith("[") and line.endswith("]"):
            current = line[1:-1].strip()
            sections[current] = {}
            continue
        if current is None or "=" not in line:
            continue
        key, _, value = line.partition("=")
        sections[current][key.strip().lower()] = value.strip()
    return sections


def _parse_pdbedit_verbose(text: str) -> list[dict[str, str]]:
    """Parse `pdbedit -L -v` output into a list of ``{field: value}`` blocks."""
    blocks: list[dict[str, str]] = []
    current: dict[str, str] = {}
    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        if not line.strip():
            if current:
                blocks.append(current)
                current = {}
            continue
        if ":" in line:
            key, _, value = line.partition(":")
            current[key.strip()] = value.strip()
    if current:
        blocks.append(current)
    return blocks


# --------------------------------------------------------------------------- scanning

def scan_shares() -> tuple[list[DiscoveredShare], str | None]:
    """Ask Samba what shares it's currently serving, via `testparm -s`.

    Returns (shares, error). `error` is set only when the scan itself could
    not be completed (e.g. testparm missing or smb.conf invalid) — an empty
    result with no error just means Samba has nothing beyond the defaults.
    """
    settings = get_settings()
    try:
        # Some installs lock smb.conf down tighter than the Debian/Ubuntu
        # default 0644 (e.g. 0640 root:root) — go through sudo like every
        # other read of a root-owned Samba file in this codebase, rather
        # than assuming the sambacontrol service user can read it directly.
        result = run(["testparm", "-s", str(settings.smb_conf)], check=False, timeout=15, sudo=True)
    except CommandError as e:
        return [], f"Could not run testparm: {e}"

    if not result.stdout.strip():
        # DEV_MODE (and a missing testparm binary) both come back as an empty,
        # zero-exit CommandResult — that's "nothing to report", not a failure.
        if result.returncode != 0 and result.stderr.strip():
            return [], result.stderr.strip()[:400]
        return [], None

    sections = _parse_testparm_dump(result.stdout)
    discovered: list[DiscoveredShare] = []
    for name, params in sections.items():
        if name.lower() in RESERVED_SECTIONS:
            continue
        path = params.get("path")
        if not path:
            continue
        valid_users_raw = params.get("valid users", "")
        valid_users = [u.strip() for u in re.split(r"[,\s]+", valid_users_raw) if u.strip()]
        if "writable" in params or "writeable" in params or "write ok" in params:
            writable = _yesno(params.get("writable") or params.get("writeable") or params.get("write ok"), False)
            read_only = not writable
        else:
            read_only = _yesno(params.get("read only"), True)
        discovered.append(DiscoveredShare(
            name=name,
            path=path,
            comment=params.get("comment") or None,
            browseable=_yesno(params.get("browseable"), True),
            read_only=read_only,
            guest_ok=_yesno(params.get("guest ok"), False),
            valid_users=valid_users,
        ))
    return discovered, None


def scan_users() -> tuple[list[DiscoveredUser], str | None]:
    """List Samba passdb accounts directly, via `pdbedit -L -v`.

    The passdb backend (typically /var/lib/samba/private/passdb.tdb) is
    root-owned and 0600 by default specifically to protect password hashes —
    the unprivileged sambacontrol service user cannot read it directly, so
    this has to go through sudo like every other privileged action here.
    """
    try:
        result = run(["pdbedit", "-L", "-v"], check=False, timeout=15, sudo=True)
    except CommandError as e:
        return [], f"Could not run pdbedit: {e}"

    if result.returncode != 0 and not result.stdout.strip():
        err = result.stderr.strip()
        benign = ("no such" in err.lower()) or ("did not find" in err.lower()) or not err
        if not benign:
            return [], err[:400]
        return [], None

    users: list[DiscoveredUser] = []
    for block in _parse_pdbedit_verbose(result.stdout):
        username = block.get("Unix username")
        if not username:
            continue
        flags = block.get("Account Flags", "")
        users.append(DiscoveredUser(
            username=username,
            display_name=block.get("Full Name") or None,
            enabled="D" not in flags,
        ))
    return users, None


def find_unmanaged(
    db: Session,
) -> tuple[list[DiscoveredShare], list[DiscoveredUser], str | None, str | None]:
    """Scan live Samba state and filter out anything already tracked in the DB."""
    known_shares = {s.lower() for s in db.scalars(select(Share.name)).all()}
    known_users = {u.lower() for u in db.scalars(select(SambaUser.username)).all()}

    shares, shares_error = scan_shares()
    users, users_error = scan_users()

    unmanaged_shares = [s for s in shares if s.name.lower() not in known_shares]
    unmanaged_users = [u for u in users if u.username.lower() not in known_users]
    return unmanaged_shares, unmanaged_users, shares_error, users_error


# --------------------------------------------------------------------------- adoption

def adopt_share_section(section_name: str) -> bool:
    """Best-effort: comment out `[section_name]` if it's written directly into
    the main smb.conf, so it isn't defined twice once SambaControl starts
    managing it via its own include file.

    Returns True if a section was found and commented out, False if it wasn't
    present there (e.g. it lives in some other include file SambaControl
    doesn't manage) — the caller surfaces False as a heads-up, not an error.
    """
    settings = get_settings()
    try:
        text = Path(settings.smb_conf).read_text()
    except (FileNotFoundError, PermissionError):
        return False

    target_header = f"[{section_name}]".lower()
    if target_header not in text.lower():
        return False

    lines = text.splitlines()
    out: list[str] = []
    in_target = False
    found = False
    for line in lines:
        stripped = line.strip()
        is_section = stripped.startswith("[") and stripped.endswith("]")
        if is_section:
            in_target = stripped.lower() == target_header
            if in_target:
                found = True
                out.append(
                    f"# --- Adopted into SambaControl on {datetime.now(timezone.utc):%Y-%m-%d} "
                    "— managed from the Shares page from now on ---"
                )
                out.append(f"; {line}")
                continue
        out.append(f"; {line}" if (in_target and stripped) else line)

    if not found:
        return False

    new_text = "\n".join(out).rstrip() + "\n"
    with tempfile.NamedTemporaryFile("w", suffix=".conf", delete=False) as tmp:
        tmp.write(new_text)
        tmp_path = Path(tmp.name)
    try:
        run(["testparm", "-s", str(tmp_path)], check=True, timeout=15)
        run(["install", "-m", "0644", str(tmp_path), str(settings.smb_conf)], sudo=True)
    finally:
        tmp_path.unlink(missing_ok=True)
    return True

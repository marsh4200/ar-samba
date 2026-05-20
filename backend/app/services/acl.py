"""POSIX ACL management via setfacl / getfacl.

Permission model exposed to the GUI:
* read         → r
* write        → w     (implies create_files=True too at filesystem level)
* execute      → x     (always needed for directory traversal)
* delete       → write on the *parent dir* — implied by can_write on parent
* create_files → write on the directory
* create_folders → write+execute on the directory

We map the toggle set into rwx by collapsing:
    r = can_read
    w = can_write OR can_create_files OR can_create_folders OR can_delete
    x = can_execute OR can_create_folders
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from pathlib import Path

from app.services.runner import run

logger = logging.getLogger(__name__)


@dataclass
class AclPerms:
    read: bool = False
    write: bool = False
    execute: bool = False
    delete: bool = False
    create_files: bool = False
    create_folders: bool = False
    recursive: bool = True
    default_acl: bool = True

    def to_rwx(self) -> str:
        r = "r" if self.read else "-"
        w = "w" if (self.write or self.create_files or self.create_folders or self.delete) else "-"
        x = "x" if (self.execute or self.create_folders) else "-"
        return r + w + x


_ACL_LINE = re.compile(
    r"^(?P<scope>default:)?(?P<kind>user|group|other|mask)(?::(?P<name>[^:]*))?:(?P<perms>[rwx-]{3})"
)


def set_user_acl(path: Path, username: str, perms: AclPerms) -> None:
    """Apply a user ACL to `path`."""
    if not path.exists():
        path.mkdir(parents=True, exist_ok=True)

    args = ["setfacl"]
    if perms.recursive:
        args.append("-R")
    # First the access ACL
    args.extend(["-m", f"u:{username}:{perms.to_rwx()}", str(path)])
    run(args, sudo=True)

    # Then the default ACL so newly-created files inherit
    if perms.default_acl:
        dargs = ["setfacl"]
        if perms.recursive:
            dargs.append("-R")
        dargs.extend(["-d", "-m", f"u:{username}:{perms.to_rwx()}", str(path)])
        run(dargs, sudo=True)


def remove_user_acl(path: Path, username: str) -> None:
    """Remove a user's ACL entries (access + default), recursively."""
    if not path.exists():
        return
    run(["setfacl", "-R", "-x", f"u:{username}", str(path)], sudo=True, check=False)
    run(["setfacl", "-R", "-d", "-x", f"u:{username}", str(path)], sudo=True, check=False)


def get_acl(path: Path) -> list[dict[str, str | None]]:
    """Parse `getfacl` output for `path`."""
    if not path.exists():
        return []
    r = run(["getfacl", "-p", "--", str(path)], check=False)
    entries: list[dict[str, str | None]] = []
    for line in r.stdout.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = _ACL_LINE.match(line)
        if not m:
            continue
        scope = m.group("scope") or ""
        entries.append({
            "kind": (scope + m.group("kind")) if scope else m.group("kind"),
            "name": m.group("name") or None,
            "perms": m.group("perms"),
        })
    return entries


def ensure_directory(path: Path, owner: str = "root", group: str = "users", mode: str = "2770") -> None:
    """Create the share directory with sane defaults if missing."""
    run(["mkdir", "-p", str(path)], sudo=True)
    run(["chown", f"{owner}:{group}", str(path)], sudo=True)
    # 2770 = setgid + rwxrwx--- so new files inherit the group
    run(["chmod", mode, str(path)], sudo=True)

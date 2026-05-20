"""System status helpers — service health, disk usage."""
from __future__ import annotations

import shutil
from pathlib import Path

import psutil

from app.core.config import get_settings
from app.services.samba import samba_service_status


def all_service_status() -> list[dict]:
    services = []
    for unit in ("smbd", "nmbd"):
        active, state, pid = samba_service_status(unit)
        services.append({"name": unit, "active": active, "state": state, "pid": pid})
    return services


def storage_for_shares_root() -> list[dict]:
    settings = get_settings()
    root = settings.shares_root
    try:
        usage = shutil.disk_usage(root if root.exists() else root.anchor or "/")
    except (FileNotFoundError, PermissionError):
        usage = shutil.disk_usage("/")
    return [{
        "path": str(root),
        "total_bytes": usage.total,
        "used_bytes": usage.used,
        "free_bytes": usage.free,
        "percent": (usage.used / usage.total * 100) if usage.total else 0.0,
    }]


def host_uptime_seconds() -> int:
    import time
    return int(time.time() - psutil.boot_time())

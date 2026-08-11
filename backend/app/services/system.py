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


def host_metrics() -> dict:
    """Live CPU / memory / load / uptime for the dashboard gauges.

    Uses the already-vendored psutil. ``cpu_percent`` is called non-blocking so
    the request never stalls; it reports usage since the previous call, which
    is exactly what a polling dashboard wants.
    """
    import platform
    import socket

    vm = psutil.virtual_memory()
    sm = psutil.swap_memory()

    try:
        load1, load5, load15 = psutil.getloadavg()
    except (AttributeError, OSError):  # not available on every platform
        load1 = load5 = load15 = 0.0

    return {
        "hostname": socket.gethostname(),
        "kernel": platform.release(),
        "cpu_percent": round(psutil.cpu_percent(interval=None), 1),
        "cpu_cores": psutil.cpu_count(logical=False) or 0,
        "cpu_threads": psutil.cpu_count(logical=True) or 0,
        "load_1": round(load1, 2),
        "load_5": round(load5, 2),
        "load_15": round(load15, 2),
        "memory_total": vm.total,
        "memory_used": vm.total - vm.available,
        "memory_percent": round(vm.percent, 1),
        "swap_total": sm.total,
        "swap_used": sm.used,
        "swap_percent": round(sm.percent, 1),
        "uptime_seconds": host_uptime_seconds(),
    }

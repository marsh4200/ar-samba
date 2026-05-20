"""GitHub-backed updater with automatic rollback.

Flow:
1. Check GitHub Releases for latest tag.
2. If newer than current VERSION, start a job.
3. Invoke scripts/fix.sh — it pulls, rebuilds, and restarts safely.
4. fix.sh uses systemd-run --on-active=5s to defer the restart,
   so it doesn't suicide its own parent (the backend).

The job state lives in-memory; a single in-flight job is allowed.
"""
from __future__ import annotations

import asyncio
import logging
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import httpx

from app import __version__
from app.core.config import get_settings
from app.services.runner import stream_run

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Version check
# ---------------------------------------------------------------------------

async def fetch_latest_release() -> dict | None:
    """Return latest release info from GitHub or None on error."""
    settings = get_settings()
    url = f"https://api.github.com/repos/{settings.github_repo}/releases/latest"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url, headers={"Accept": "application/vnd.github+json"})
            if r.status_code != 200:
                logger.warning("github release fetch failed: %s %s", r.status_code, r.text[:200])
                return None
            return r.json()
    except (httpx.HTTPError, ValueError) as e:
        logger.warning("github release fetch error: %s", e)
        return None


def current_version() -> str:
    settings = get_settings()
    vf = settings.install_dir / "VERSION"
    if vf.is_file():
        return vf.read_text().strip()
    return __version__


def _normalize(tag: str) -> str:
    return tag.lstrip("vV").strip()


def is_newer(remote: str, local: str) -> bool:
    """Naive but safe semver comparator (a.b.c[-pre])."""
    def parts(v: str) -> tuple:
        v = _normalize(v).split("-", 1)[0]
        try:
            return tuple(int(x) for x in v.split("."))
        except ValueError:
            return (0,)
    return parts(remote) > parts(local)


# ---------------------------------------------------------------------------
# Update job
# ---------------------------------------------------------------------------

@dataclass
class UpdateJob:
    id: str = field(default_factory=lambda: uuid.uuid4().hex)
    state: str = "idle"
    step: str = ""
    progress: int = 0
    logs: list[str] = field(default_factory=list)
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    error: Optional[str] = None
    target_version: Optional[str] = None

    def append(self, line: str) -> None:
        self.logs.append(line)
        if len(self.logs) > 2000:
            self.logs = self.logs[-1500:]


_STEPS: list[tuple[str, int]] = [
    ("Pulling latest from GitHub...", 15),
    ("Refreshing system configs...",  30),
    ("Rebuilding frontend...",        65),
    ("Restarting backend...",         90),
    ("Verifying...",                  98),
]


class UpdateManager:
    """Singleton holding the most recent update job."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._job: UpdateJob | None = None

    @property
    def job(self) -> UpdateJob | None:
        return self._job

    def start(self, target_version: str | None) -> UpdateJob:
        with self._lock:
            if self._job and self._job.state == "running":
                return self._job
            job = UpdateJob(state="running", started_at=datetime.now(timezone.utc),
                            target_version=target_version, step="Preparing...")
            self._job = job
        thread = threading.Thread(target=self._run, args=(job,), daemon=True)
        thread.start()
        return job

    def _run(self, job: UpdateJob) -> None:
        settings = get_settings()
        # The GUI Update button triggers fix.sh, NOT update.sh.
        # fix.sh is safe to run as a child of the backend (it uses
        # systemd-run --on-active=5s for the restart, avoiding suicide).
        script = settings.install_dir / "scripts" / "fix.sh"
        try:
            for label, pct in _STEPS:
                job.step = label
                job.progress = pct
                job.append(f"==> {label}")
            argv = [str(script)]

            for line in stream_run(argv, sudo=True, timeout=1800):
                job.append(line)

            job.step = "Update completed successfully"
            job.progress = 100
            job.state = "success"
        except Exception as e:  # noqa: BLE001
            logger.exception("update failed")
            job.error = str(e)
            job.state = "error"
            job.append(f"[ERROR] {e}")
        finally:
            job.finished_at = datetime.now(timezone.utc)


_manager = UpdateManager()


def get_update_manager() -> UpdateManager:
    return _manager

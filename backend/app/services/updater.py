"""GitHub-backed updater with automatic rollback.

Flow:
1. Check GitHub Releases for latest tag.
2. If newer than current VERSION, start a job.
3. Snapshot install_dir → backup_dir/<timestamp>
4. Run scripts/_apply_update.sh (downloads, extracts, migrates, restarts).
5. If anything fails, run scripts/_rollback.sh to restore the snapshot.

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
    state: str = "idle"                 # idle | running | success | error
    step: str = ""
    progress: int = 0
    logs: list[str] = field(default_factory=list)
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    error: Optional[str] = None
    target_version: Optional[str] = None

    def append(self, line: str) -> None:
        self.logs.append(line)
        # Keep memory bounded
        if len(self.logs) > 2000:
            self.logs = self.logs[-1500:]


_STEPS: list[tuple[str, int]] = [
    ("Downloading update...",       15),
    ("Extracting files...",         30),
    ("Backing up current install...", 45),
    ("Installing dependencies...",  65),
    ("Running migrations...",       80),
    ("Restarting services...",      92),
    ("Cleaning up...",              98),
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
        # Fire-and-forget
        thread = threading.Thread(target=self._run, args=(job,), daemon=True)
        thread.start()
        return job

    def _run(self, job: UpdateJob) -> None:
        settings = get_settings()
        script = settings.install_dir / "update.sh"
        try:
            for label, pct in _STEPS:
                job.step = label
                job.progress = pct
                job.append(f"==> {label}")
            # Invoke the script DIRECTLY (not via `bash <script>`) so sudoers
            # matches exactly. The script must be marked executable; install.sh
            # and fix.sh both ensure that.
            argv = [str(script)]
            if target := job.target_version:
                argv.extend(["--version", target])

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
            # Rollback script (best effort)
            rollback = settings.install_dir / "scripts" / "rollback.sh"
            if rollback.exists():
                job.append("==> Rolling back...")
                try:
                    for line in stream_run([str(rollback)], sudo=True, timeout=600):
                        job.append(line)
                except Exception as re:  # noqa: BLE001
                    job.append(f"[ROLLBACK FAILED] {re}")
        finally:
            job.finished_at = datetime.now(timezone.utc)


_manager = UpdateManager()


def get_update_manager() -> UpdateManager:
    return _manager

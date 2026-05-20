"""GitHub-backed updater endpoints."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import AdminOnly
from app.core.database import get_db
from app.schemas.system import UpdateJobStatus, VersionInfo
from app.services import updater
from app.services.activity import log_activity

router = APIRouter(prefix="/updates", tags=["updates"])


@router.get("/version", response_model=VersionInfo)
async def version_info() -> VersionInfo:
    current = updater.current_version()
    release = await updater.fetch_latest_release()
    if not release:
        return VersionInfo(current=current)
    latest = updater._normalize(release.get("tag_name", "") or "")
    return VersionInfo(
        current=current,
        latest=latest,
        update_available=bool(latest) and updater.is_newer(latest, current),
        release_notes=release.get("body"),
        release_url=release.get("html_url"),
    )


@router.post("/start", response_model=UpdateJobStatus)
def start_update(
    db: Annotated[Session, Depends(get_db)],
    actor: AdminOnly,
    target: str | None = None,
) -> UpdateJobStatus:
    mgr = updater.get_update_manager()
    if mgr.job and mgr.job.state == "running":
        raise HTTPException(status.HTTP_409_CONFLICT, "Update already in progress")
    job = mgr.start(target)
    log_activity(db, actor=actor.username, category="update", action="start", target=target)
    return _to_status(job)


@router.get("/status", response_model=UpdateJobStatus | None)
def get_status() -> UpdateJobStatus | None:
    mgr = updater.get_update_manager()
    return _to_status(mgr.job) if mgr.job else None


def _to_status(job: updater.UpdateJob) -> UpdateJobStatus:
    return UpdateJobStatus(
        id=job.id,
        state=job.state,
        step=job.step,
        progress=job.progress,
        logs=job.logs[-300:],
        started_at=job.started_at,
        finished_at=job.finished_at,
        error=job.error,
    )

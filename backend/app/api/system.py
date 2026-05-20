"""Dashboard + system status endpoints."""
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.core.database import get_db
from app.models.activity import ActivityLog
from app.models.share import Share
from app.models.user import SambaUser
from app.schemas.system import ActivityOut, DashboardOut, ServiceStatus, StorageInfo
from app.services import system as sys_svc
from app.services.samba import reload_samba
from app.services.activity import log_activity
from app import __version__

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(db: Annotated[Session, Depends(get_db)], _u: CurrentUser) -> DashboardOut:
    user_count = db.scalar(select(func.count()).select_from(SambaUser)) or 0
    share_count = db.scalar(select(func.count()).select_from(Share)) or 0

    services = [ServiceStatus(**s) for s in sys_svc.all_service_status()]
    storage = [StorageInfo(**s) for s in sys_svc.storage_for_shares_root()]

    recent = list(db.scalars(
        select(ActivityLog).order_by(desc(ActivityLog.ts)).limit(10)
    ).all())
    recent_out = [ActivityOut(
        id=r.id, ts=r.ts, actor=r.actor, category=r.category,
        action=r.action, target=r.target, status=r.status, details=r.details,
    ) for r in recent]

    return DashboardOut(
        user_count=user_count,
        share_count=share_count,
        services=services,
        storage=storage,
        recent_activity=recent_out,
        version=__version__,
    )


@router.post("/samba/reload", status_code=204)
def trigger_reload(db: Annotated[Session, Depends(get_db)], actor: CurrentUser) -> None:
    reload_samba()
    log_activity(db, actor=actor.username, category="samba", action="reload")
    @router.get("/idle-timeout", response_model=dict)
def get_idle_timeout(_: AdminUser = Depends(get_current_admin)) -> dict:
    """Return the configured idle-logout timeout in minutes (0 = disabled)."""
    return {"minutes": get_settings().idle_timeout_minutes}


@router.put("/idle-timeout", response_model=dict)
def set_idle_timeout(
    payload: dict,
    _: AdminUser = Depends(get_current_admin),
) -> dict:
    """Update the idle-logout timeout (writes to the .env file)."""
    from pathlib import Path
    import re

    minutes = int(payload.get("minutes", 15))
    if minutes < 0 or minutes > 1440:
        from fastapi import HTTPException
        raise HTTPException(400, "minutes must be 0-1440")

    env_path = Path("/opt/sambacontrol/.env")
    if not env_path.exists():
        from fastapi import HTTPException
        raise HTTPException(500, ".env not found")

    text = env_path.read_text()
    line = f"SAMBACONTROL_IDLE_TIMEOUT_MINUTES={minutes}"
    if re.search(r"^SAMBACONTROL_IDLE_TIMEOUT_MINUTES=", text, re.M):
        text = re.sub(r"^SAMBACONTROL_IDLE_TIMEOUT_MINUTES=.*$", line, text, flags=re.M)
    else:
        text = text.rstrip() + f"\n{line}\n"
    env_path.write_text(text)

    # Update the live in-memory setting so next /idle-timeout read returns it
    get_settings().idle_timeout_minutes = minutes
    return {"minutes": minutes}

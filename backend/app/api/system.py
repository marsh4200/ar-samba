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

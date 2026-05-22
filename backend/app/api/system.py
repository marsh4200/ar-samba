"""Dashboard + system status endpoints."""
import re
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser
from app.core.config import get_settings
from app.core.database import get_db
from app.models.activity import ActivityLog
from app.models.share import Share, ShareAccess
from app.models.user import SambaUser
from app.schemas.system import ActivityOut, DashboardOut, ServiceStatus, StorageInfo
from app.services import samba as samba_svc
from app.services import system as sys_svc
from app.services.activity import log_activity
from app.services.samba import reload_samba
from app import __version__

router = APIRouter(prefix="/system", tags=["system"])


def _write_env_var(key: str, value: str | int) -> None:
    """Write or update one SAMBACONTROL_* variable in /opt/sambacontrol/.env."""
    env_path = Path("/opt/sambacontrol/.env")
    if not env_path.exists():
        raise HTTPException(500, ".env not found")
    try:
        text = env_path.read_text()
        line = f"{key}={value}"
        if re.search(rf"^{re.escape(key)}=", text, re.M):
            text = re.sub(rf"^{re.escape(key)}=.*$", line, text, flags=re.M)
        else:
            text = text.rstrip() + f"\n{line}\n"
        env_path.write_text(text)
    except PermissionError as e:
        raise HTTPException(500, f"cannot write .env: {e}") from e


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


# ─── Idle-logout timeout (web GUI) ──────────────────────────────────────────

class IdleTimeoutOut(BaseModel):
    minutes: int = Field(ge=0, le=1440)


class IdleTimeoutIn(BaseModel):
    minutes: int = Field(ge=0, le=1440, description="0 disables auto-logout")


@router.get("/idle-timeout", response_model=IdleTimeoutOut)
def get_idle_timeout(_u: CurrentUser) -> IdleTimeoutOut:
    """Return the configured web-GUI idle-logout timeout in minutes (0 = disabled)."""
    return IdleTimeoutOut(minutes=get_settings().idle_timeout_minutes)


@router.put("/idle-timeout", response_model=IdleTimeoutOut)
def set_idle_timeout(
    payload: IdleTimeoutIn,
    db: Annotated[Session, Depends(get_db)],
    actor: CurrentUser,
) -> IdleTimeoutOut:
    """Update the web-GUI idle-logout timeout. Persisted to /opt/sambacontrol/.env."""
    minutes = payload.minutes
    _write_env_var("SAMBACONTROL_IDLE_TIMEOUT_MINUTES", minutes)
    get_settings().idle_timeout_minutes = minutes
    log_activity(db, actor=actor.username, category="system",
                 action="idle_timeout_set", target=str(minutes), status="ok")
    return IdleTimeoutOut(minutes=minutes)


# ─── SMB session deadtime (server-side, kicks idle Windows clients) ─────────

class SmbDeadtimeOut(BaseModel):
    minutes: int = Field(ge=0, le=1440)


class SmbDeadtimeIn(BaseModel):
    minutes: int = Field(ge=0, le=1440,
                         description="0 disables; only kicks idle clients with NO open files")


@router.get("/smb-deadtime", response_model=SmbDeadtimeOut)
def get_smb_deadtime(_u: CurrentUser) -> SmbDeadtimeOut:
    """Return the configured Samba session deadtime in minutes."""
    return SmbDeadtimeOut(minutes=get_settings().smb_deadtime_minutes)


@router.put("/smb-deadtime", response_model=SmbDeadtimeOut)
def set_smb_deadtime(
    payload: SmbDeadtimeIn,
    db: Annotated[Session, Depends(get_db)],
    actor: CurrentUser,
) -> SmbDeadtimeOut:
    """Update Samba's deadtime, persist to .env, rewrite sambacontrol.conf, reload Samba."""
    minutes = payload.minutes

    # Persist
    _write_env_var("SAMBACONTROL_SMB_DEADTIME_MINUTES", minutes)
    get_settings().smb_deadtime_minutes = minutes

    # Rewrite the SambaControl-managed include with the new global block,
    # then reload smbd so the setting takes effect immediately.
    shares = list(db.scalars(
        select(Share).options(selectinload(Share.grants).selectinload(ShareAccess.user))
    ).all())
    specs = [samba_svc.ShareSpec(
        name=s.name, path=s.path, comment=s.comment,
        browseable=s.browseable, read_only=s.read_only, guest_ok=s.guest_ok,
        valid_users=[g.user.username for g in s.grants],
    ) for s in shares]
    try:
        samba_svc.write_smb_include(specs)
        samba_svc.reload_samba()
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, f"failed to apply samba config: {e}") from e

    log_activity(db, actor=actor.username, category="samba",
                 action="deadtime_set", target=str(minutes), status="ok")
    return SmbDeadtimeOut(minutes=minutes)

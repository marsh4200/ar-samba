"""Activity-log query endpoint."""
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.core.database import get_db
from app.models.activity import ActivityLog
from app.schemas.system import ActivityOut

router = APIRouter(prefix="/logs", tags=["logs"])


@router.get("", response_model=list[ActivityOut])
def list_logs(
    db: Annotated[Session, Depends(get_db)],
    _u: CurrentUser,
    category: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[ActivityOut]:
    stmt = select(ActivityLog).order_by(desc(ActivityLog.ts))
    if category:
        stmt = stmt.where(ActivityLog.category == category)
    stmt = stmt.limit(limit).offset(offset)
    rows = list(db.scalars(stmt).all())
    return [ActivityOut(
        id=r.id, ts=r.ts, actor=r.actor, category=r.category,
        action=r.action, target=r.target, status=r.status, details=r.details,
    ) for r in rows]

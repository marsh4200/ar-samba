"""Helpers for writing entries to the ActivityLog table."""
from __future__ import annotations

import logging
from typing import Literal

from sqlalchemy.orm import Session

from app.models.activity import ActivityLog

logger = logging.getLogger(__name__)


def log_activity(
    db: Session,
    *,
    actor: str,
    category: Literal["auth", "user", "share", "acl", "samba", "update", "system"],
    action: str,
    target: str | None = None,
    status: Literal["ok", "error"] = "ok",
    details: str | None = None,
) -> ActivityLog:
    entry = ActivityLog(
        actor=actor,
        category=category,
        action=action,
        target=target,
        status=status,
        details=details,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    logger.info("[%s] %s %s target=%s status=%s", category, actor, action, target, status)
    return entry

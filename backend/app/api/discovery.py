"""Discover Samba shares/users that were set up outside SambaControl (e.g. by
hand over SSH) and adopt them into the database on request.

Two endpoints:
* `GET  /discovery/scan`   — read-only. Diffs live Samba state against the DB.
* `POST /discovery/import` — adopts a chosen subset of what the scan found.

The import endpoint re-scans rather than trusting client-supplied share/user
details, so nothing about an adopted share (path, flags, valid users) comes
from the browser — it's always read back from Samba itself at import time.
"""
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.api.shares import _rewrite_smb_include
from app.core.database import get_db
from app.models.share import Share, ShareAccess
from app.models.user import SambaUser
from app.schemas.discovery import (
    DiscoveredShareOut,
    DiscoveredUserOut,
    DiscoveryImportIn,
    DiscoveryImportOut,
    DiscoveryScanOut,
    ImportItemResult,
)
from app.services import discovery as discovery_svc
from app.services.activity import log_activity
from app.services.runner import CommandError

router = APIRouter(prefix="/discovery", tags=["discovery"])


@router.get("/scan", response_model=DiscoveryScanOut)
def scan(db: Annotated[Session, Depends(get_db)], _u: CurrentUser) -> DiscoveryScanOut:
    """Look for shares/users Samba already knows about that SambaControl doesn't."""
    shares, users, shares_error, users_error = discovery_svc.find_unmanaged(db)
    return DiscoveryScanOut(
        scanned_at=datetime.now(timezone.utc),
        shares=[DiscoveredShareOut(**vars(s)) for s in shares],
        users=[DiscoveredUserOut(**vars(u)) for u in users],
        shares_error=shares_error,
        users_error=users_error,
    )


@router.post("/import", response_model=DiscoveryImportOut)
def import_selected(
    payload: DiscoveryImportIn,
    db: Annotated[Session, Depends(get_db)],
    actor: CurrentUser,
) -> DiscoveryImportOut:
    """Adopt the requested shares/users, re-verifying each against a fresh scan."""
    disc_shares, disc_users, _shares_err, _users_err = discovery_svc.find_unmanaged(db)
    shares_by_name = {s.name.lower(): s for s in disc_shares}
    users_by_name = {u.username.lower(): u for u in disc_users}

    user_results: list[ImportItemResult] = []
    share_results: list[ImportItemResult] = []

    # --- users first, so shares can grant access to ones adopted in this same call
    for requested in payload.usernames:
        key = requested.lower()
        existing = db.scalar(select(SambaUser).where(SambaUser.username == requested))
        if existing:
            user_results.append(ImportItemResult(
                name=requested, status="skipped", detail="Already tracked by SambaControl.",
            ))
            continue
        found = users_by_name.get(key)
        if not found:
            user_results.append(ImportItemResult(
                name=requested, status="skipped",
                detail="No longer found as a Samba account — it may have changed since the scan.",
            ))
            continue

        user = SambaUser(
            username=found.username,
            display_name=found.display_name,
            enabled=found.enabled,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        log_activity(
            db, actor=actor.username, category="user", action="import", target=user.username,
            details="Adopted an existing Samba account — its password was left untouched.",
        )
        note = "Existing Samba account adopted; its password was left as-is."
        if not found.enabled:
            note += " It was disabled in Samba, so it stays disabled here."
        user_results.append(ImportItemResult(name=user.username, status="imported", detail=note))

    # --- then shares
    known_users = {u.lower() for u in db.scalars(select(SambaUser.username)).all()}
    for requested in payload.share_names:
        key = requested.lower()
        if db.scalar(select(Share).where(Share.name == requested)):
            share_results.append(ImportItemResult(
                name=requested, status="skipped", detail="Already tracked by SambaControl.",
            ))
            continue
        found = shares_by_name.get(key)
        if not found:
            share_results.append(ImportItemResult(
                name=requested, status="skipped",
                detail="No longer found in the Samba config — it may have changed since the scan.",
            ))
            continue

        share = Share(
            name=found.name,
            path=found.path,
            comment=found.comment,
            browseable=found.browseable,
            read_only=found.read_only,
            guest_ok=found.guest_ok,
        )
        db.add(share)
        db.commit()
        db.refresh(share)

        try:
            _rewrite_smb_include(db)
        except CommandError as e:
            db.delete(share)
            db.commit()
            share_results.append(ImportItemResult(
                name=requested, status="error",
                detail=f"Samba config write failed: {e.result.stderr.strip()[:200]}",
            ))
            continue

        # Record who already had access (from `valid users =`) as DB grants.
        # We intentionally do NOT touch filesystem ACLs here — the folder's
        # existing permissions are left exactly as they were.
        granted = [u for u in found.valid_users if u.lower() in known_users]
        for username in granted:
            grantee = db.scalar(select(SambaUser).where(SambaUser.username == username))
            if not grantee:
                continue
            db.add(ShareAccess(
                share_id=share.id, user_id=grantee.id,
                can_read=True, can_write=not found.read_only, can_execute=True,
                can_delete=False,
                can_create_files=not found.read_only, can_create_folders=not found.read_only,
                recursive=True, default_acl=True,
            ))
        if granted:
            db.commit()

        adopted_inline = False
        try:
            adopted_inline = discovery_svc.adopt_share_section(share.name)
        except CommandError as e:
            logger_detail = f"; could not remove the original smb.conf entry automatically ({e})"
        else:
            logger_detail = "" if adopted_inline else (
                "; its original definition wasn't found directly in smb.conf (likely a different "
                "include file) — remove it by hand if Samba warns about a duplicate share"
            )

        log_activity(
            db, actor=actor.username, category="share", action="import", target=share.name,
            details=f"Adopted from live Samba config, path={share.path}",
        )
        detail = "Adopted from the existing Samba config; the folder and its permissions were left untouched."
        if granted:
            detail += f" Access recorded for {len(granted)} user(s) from its valid users list."
        detail += logger_detail
        share_results.append(ImportItemResult(name=share.name, status="imported", detail=detail))

    return DiscoveryImportOut(users=user_results, shares=share_results)

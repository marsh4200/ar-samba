"""Share CRUD plus per-share access (ACL) management."""
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import CurrentUser
from app.core.database import get_db
from app.models.share import Share, ShareAccess
from app.models.user import SambaUser
from app.schemas.share import AclEntry, ShareAccessIn, ShareAccessOut, ShareCreate, ShareOut, ShareUpdate
from app.services import acl as acl_svc
from app.services import samba as samba_svc
from app.services.activity import log_activity
from app.services.runner import CommandError
from app.utils.validators import ValidationError, resolve_share_path, validate_share_name

router = APIRouter(prefix="/shares", tags=["shares"])


# --------------------------------------------------------------------------- helpers

def _spec_for(share: Share) -> samba_svc.ShareSpec:
    return samba_svc.ShareSpec(
        name=share.name,
        path=share.path,
        comment=share.comment,
        browseable=share.browseable,
        read_only=share.read_only,
        guest_ok=share.guest_ok,
        valid_users=[g.user.username for g in share.grants],
    )


def _rewrite_smb_include(db: Session) -> None:
    shares = list(db.scalars(
        select(Share).options(selectinload(Share.grants).selectinload(ShareAccess.user))
    ).all())
    specs = [_spec_for(s) for s in shares]
    samba_svc.write_smb_include(specs)
    samba_svc.reload_samba()


def _apply_grant_acls(share: Share, grant: ShareAccess) -> None:
    perms = acl_svc.AclPerms(
        read=grant.can_read,
        write=grant.can_write,
        execute=grant.can_execute,
        delete=grant.can_delete,
        create_files=grant.can_create_files,
        create_folders=grant.can_create_folders,
        recursive=grant.recursive,
        default_acl=grant.default_acl,
    )
    acl_svc.set_user_acl(Path(share.path), grant.user.username, perms)


# --------------------------------------------------------------------------- shares

@router.get("", response_model=list[ShareOut])
def list_shares(db: Annotated[Session, Depends(get_db)], _u: CurrentUser) -> list[Share]:
    return list(db.scalars(select(Share).order_by(Share.name)).all())


@router.post("", response_model=ShareOut, status_code=status.HTTP_201_CREATED)
def create_share(
    payload: ShareCreate,
    db: Annotated[Session, Depends(get_db)],
    actor: CurrentUser,
) -> Share:
    try:
        validate_share_name(payload.name)
        full_path = resolve_share_path(payload.path)
    except ValidationError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e

    if db.scalar(select(Share).where(Share.name == payload.name)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Share name already in use")

    try:
        acl_svc.ensure_directory(full_path)
    except CommandError as e:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR,
                            f"Could not create share directory: {e.result.stderr[:200]}") from e

    share = Share(
        name=payload.name,
        path=str(full_path),
        comment=payload.comment,
        browseable=payload.browseable,
        read_only=payload.read_only,
        guest_ok=payload.guest_ok,
    )
    db.add(share)
    db.commit()
    db.refresh(share)

    try:
        _rewrite_smb_include(db)
    except CommandError as e:
        # Roll back the DB row if config write fails
        db.delete(share)
        db.commit()
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR,
                            f"Samba config write failed: {e}") from e

    log_activity(db, actor=actor.username, category="share", action="create",
                 target=share.name, details=str(full_path))
    return share


@router.patch("/{share_id}", response_model=ShareOut)
def update_share(
    share_id: int,
    payload: ShareUpdate,
    db: Annotated[Session, Depends(get_db)],
    actor: CurrentUser,
) -> Share:
    share = db.get(Share, share_id)
    if not share:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Share not found")
    for field in ("comment", "browseable", "read_only", "guest_ok"):
        v = getattr(payload, field)
        if v is not None:
            setattr(share, field, v)
    db.commit()
    db.refresh(share)
    _rewrite_smb_include(db)
    log_activity(db, actor=actor.username, category="share", action="update", target=share.name)
    return share


@router.delete("/{share_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_share(
    share_id: int,
    db: Annotated[Session, Depends(get_db)],
    actor: CurrentUser,
) -> None:
    share = db.get(Share, share_id)
    if not share:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Share not found")
    name = share.name
    db.delete(share)
    db.commit()
    _rewrite_smb_include(db)
    log_activity(db, actor=actor.username, category="share", action="delete", target=name)
    # NB: we intentionally do not rm -rf the share dir; admin must do that manually.


# --------------------------------------------------------------------------- access / ACL

@router.get("/{share_id}/access", response_model=list[ShareAccessOut])
def list_access(
    share_id: int,
    db: Annotated[Session, Depends(get_db)],
    _u: CurrentUser,
) -> list[ShareAccess]:
    share = db.get(Share, share_id)
    if not share:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Share not found")
    return list(share.grants)


@router.put("/{share_id}/access", response_model=ShareAccessOut)
def upsert_access(
    share_id: int,
    payload: ShareAccessIn,
    db: Annotated[Session, Depends(get_db)],
    actor: CurrentUser,
) -> ShareAccess:
    share = db.get(Share, share_id)
    if not share:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Share not found")
    user = db.get(SambaUser, payload.user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    grant = db.scalar(select(ShareAccess).where(
        ShareAccess.share_id == share_id,
        ShareAccess.user_id == user.id,
    ))
    if not grant:
        grant = ShareAccess(share_id=share_id, user_id=user.id)
        db.add(grant)
    for k, v in payload.model_dump(exclude={"user_id"}).items():
        setattr(grant, k, v)
    db.commit()
    db.refresh(grant)

    try:
        _apply_grant_acls(share, grant)
    except CommandError as e:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR,
                            f"ACL apply failed: {e.result.stderr[:200]}") from e

    _rewrite_smb_include(db)
    log_activity(db, actor=actor.username, category="acl", action="upsert",
                 target=f"{share.name}:{user.username}")
    return grant


@router.delete("/{share_id}/access/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_access(
    share_id: int,
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
    actor: CurrentUser,
) -> None:
    share = db.get(Share, share_id)
    user = db.get(SambaUser, user_id)
    if not share or not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Share or user not found")
    grant = db.scalar(select(ShareAccess).where(
        ShareAccess.share_id == share_id,
        ShareAccess.user_id == user_id,
    ))
    if not grant:
        return
    db.delete(grant)
    db.commit()
    try:
        acl_svc.remove_user_acl(Path(share.path), user.username)
    except CommandError:
        pass  # best effort
    _rewrite_smb_include(db)
    log_activity(db, actor=actor.username, category="acl", action="revoke",
                 target=f"{share.name}:{user.username}")


@router.get("/{share_id}/acl", response_model=list[AclEntry])
def read_acl(
    share_id: int,
    db: Annotated[Session, Depends(get_db)],
    _u: CurrentUser,
) -> list[AclEntry]:
    share = db.get(Share, share_id)
    if not share:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Share not found")
    entries = acl_svc.get_acl(Path(share.path))
    return [AclEntry(**e) for e in entries]

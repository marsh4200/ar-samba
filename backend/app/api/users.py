"""CRUD for Samba (managed) users."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.core.database import get_db
from app.models.user import SambaUser
from app.models.share import ShareAccess
from app.schemas.user import SambaUserCreate, SambaUserOut, SambaUserPasswordReset, SambaUserUpdate
from app.services import samba as samba_svc
from app.services.activity import log_activity
from app.services.runner import CommandError
from app.utils.validators import ValidationError, validate_username

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[SambaUserOut])
def list_users(db: Annotated[Session, Depends(get_db)], _user: CurrentUser) -> list[SambaUser]:
    return list(db.scalars(select(SambaUser).order_by(SambaUser.username)).all())


@router.post("", response_model=SambaUserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: SambaUserCreate,
    db: Annotated[Session, Depends(get_db)],
    actor: CurrentUser,
) -> SambaUser:
    try:
        validate_username(payload.username)
    except ValidationError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e

    if db.scalar(select(SambaUser).where(SambaUser.username == payload.username)):
        raise HTTPException(status.HTTP_409_CONFLICT, "User already exists")

    try:
        samba_svc.create_system_user(payload.username, payload.password, payload.display_name)
    except CommandError as e:
        log_activity(db, actor=actor.username, category="user", action="create",
                     target=payload.username, status="error", details=str(e))
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR,
                            f"System command failed: {e.result.stderr.strip()[:300]}") from e

    user = SambaUser(username=payload.username, display_name=payload.display_name, enabled=True)
    db.add(user)
    db.commit()
    db.refresh(user)

    log_activity(db, actor=actor.username, category="user", action="create", target=user.username)
    return user


@router.patch("/{user_id}", response_model=SambaUserOut)
def update_user(
    user_id: int,
    payload: SambaUserUpdate,
    db: Annotated[Session, Depends(get_db)],
    actor: CurrentUser,
) -> SambaUser:
    user = db.get(SambaUser, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    if payload.display_name is not None:
        user.display_name = payload.display_name
    if payload.enabled is not None and payload.enabled != user.enabled:
        try:
            samba_svc.smb_enable_user(user.username, payload.enabled)
        except CommandError as e:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, str(e)) from e
        user.enabled = payload.enabled

    db.commit()
    db.refresh(user)
    log_activity(db, actor=actor.username, category="user", action="update", target=user.username)
    return user


@router.post("/{user_id}/password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(
    user_id: int,
    payload: SambaUserPasswordReset,
    db: Annotated[Session, Depends(get_db)],
    actor: CurrentUser,
) -> None:
    user = db.get(SambaUser, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    try:
        samba_svc.smb_set_password(user.username, payload.password)
    except CommandError as e:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, str(e)) from e
    log_activity(db, actor=actor.username, category="user", action="password_reset",
                 target=user.username)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
    actor: CurrentUser,
) -> None:
    user = db.get(SambaUser, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    # Clean up: remove ACLs on every share the user can access, then delete OS+samba user
    from app.services.acl import remove_user_acl
    from pathlib import Path
    for grant in list(user.share_grants):
        try:
            remove_user_acl(Path(grant.share.path), user.username)
        except CommandError:
            pass  # best-effort cleanup

    try:
        samba_svc.delete_system_user(user.username)
    except CommandError as e:
        log_activity(db, actor=actor.username, category="user", action="delete",
                     target=user.username, status="error", details=str(e))
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, str(e)) from e

    db.delete(user)
    db.commit()

    # Refresh smb.conf to drop them from `valid users` lines
    from app.api.shares import _rewrite_smb_include
    _rewrite_smb_include(db)

    log_activity(db, actor=actor.username, category="user", action="delete", target=user.username)

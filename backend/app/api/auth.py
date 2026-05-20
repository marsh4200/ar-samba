"""Authentication and first-run setup."""
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.core.database import get_db
from app.core.security import create_access_token, create_refresh_token, decode_token, hash_password, verify_password
from app.models.user import AdminUser, Role
from app.schemas.auth import FirstRunIn, LoginIn, MeOut, SetupStatus, TokenOut
from app.services.activity import log_activity

router = APIRouter(prefix="/auth", tags=["auth"])


def _initialised(db: Session) -> bool:
    return db.scalar(select(AdminUser.id).limit(1)) is not None


@router.get("/setup-status", response_model=SetupStatus)
def setup_status(db: Annotated[Session, Depends(get_db)]) -> SetupStatus:
    return SetupStatus(initialised=_initialised(db))


@router.post("/setup", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def first_run_setup(
    payload: FirstRunIn,
    db: Annotated[Session, Depends(get_db)],
) -> TokenOut:
    """Create the first admin account. Only callable when no admin exists."""
    if _initialised(db):
        raise HTTPException(status.HTTP_409_CONFLICT, "Setup has already been completed.")

    admin = AdminUser(
        username=payload.username,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=Role.ADMIN.value,
        is_active=True,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)

    log_activity(db, actor=admin.username, category="auth", action="first_run_setup",
                 target=admin.username)

    return TokenOut(
        access_token=create_access_token(admin.id),
        refresh_token=create_refresh_token(admin.id),
    )


@router.post("/login", response_model=TokenOut)
def login(
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[Session, Depends(get_db)],
) -> TokenOut:
    user = db.scalar(select(AdminUser).where(AdminUser.username == form.username))
    if not user or not user.is_active or not verify_password(form.password, user.password_hash):
        # Generic message; don't reveal which condition failed
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    log_activity(db, actor=user.username, category="auth", action="login")
    return TokenOut(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/login-json", response_model=TokenOut)
def login_json(
    payload: LoginIn,
    db: Annotated[Session, Depends(get_db)],
) -> TokenOut:
    """JSON-body login for SPA convenience."""
    user = db.scalar(select(AdminUser).where(AdminUser.username == payload.username))
    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    log_activity(db, actor=user.username, category="auth", action="login")
    return TokenOut(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh", response_model=TokenOut)
def refresh(
    refresh_token: str,
    db: Annotated[Session, Depends(get_db)],
) -> TokenOut:
    try:
        payload = decode_token(refresh_token)
    except ValueError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(e)) from e
    if payload.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong token type")
    try:
        uid = int(payload["sub"])
    except (KeyError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid subject")
    user = db.get(AdminUser, uid)
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return TokenOut(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.get("/me", response_model=MeOut)
def me(user: CurrentUser) -> MeOut:
    return MeOut(
        id=user.id,
        username=user.username,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
    )

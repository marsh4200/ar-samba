"""Samba share and per-user access models."""
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Share(Base):
    """A Samba share (one [section] in smb.conf)."""

    __tablename__ = "shares"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    path: Mapped[str] = mapped_column(String(512), nullable=False)
    comment: Mapped[str | None] = mapped_column(String(255), nullable=True)
    browseable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    read_only: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    guest_ok: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)

    grants: Mapped[list["ShareAccess"]] = relationship(
        back_populates="share",
        cascade="all, delete-orphan",
    )


class ShareAccess(Base):
    """Per-user permission for a share. Drives both `valid users` and ACLs."""

    __tablename__ = "share_access"
    __table_args__ = (UniqueConstraint("share_id", "user_id", name="uq_share_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    share_id: Mapped[int] = mapped_column(ForeignKey("shares.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("samba_users.id", ondelete="CASCADE"), nullable=False)

    can_read: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    can_write: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_execute: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    can_delete: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_create_files: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_create_folders: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    recursive: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    default_acl: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    share: Mapped["Share"] = relationship(back_populates="grants")
    user: Mapped["SambaUser"] = relationship(back_populates="share_grants")  # type: ignore[name-defined]

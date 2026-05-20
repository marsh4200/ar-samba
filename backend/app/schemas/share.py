"""Share, share-access, and ACL schemas."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

SHARE_NAME_PATTERN = r"^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$"


class ShareCreate(BaseModel):
    name: str = Field(..., pattern=SHARE_NAME_PATTERN)
    # Relative to settings.shares_root unless caller passes an absolute path inside it.
    path: str = Field(..., min_length=1, max_length=512)
    comment: str | None = Field(None, max_length=255)
    browseable: bool = True
    read_only: bool = False
    guest_ok: bool = False


class ShareUpdate(BaseModel):
    comment: str | None = Field(None, max_length=255)
    browseable: bool | None = None
    read_only: bool | None = None
    guest_ok: bool | None = None


class ShareOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    path: str
    comment: str | None
    browseable: bool
    read_only: bool
    guest_ok: bool
    created_at: datetime


class ShareAccessIn(BaseModel):
    user_id: int
    can_read: bool = True
    can_write: bool = False
    can_execute: bool = True
    can_delete: bool = False
    can_create_files: bool = False
    can_create_folders: bool = False
    recursive: bool = True
    default_acl: bool = True


class ShareAccessOut(ShareAccessIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    share_id: int


class AclEntry(BaseModel):
    """Raw `getfacl` line, parsed."""
    kind: str   # user, group, other, mask, default:user, ...
    name: str | None
    perms: str  # rwx

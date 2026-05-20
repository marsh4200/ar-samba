"""Samba-user Pydantic schemas."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

USERNAME_PATTERN = r"^[a-z_][a-z0-9_-]{0,31}$"


class SambaUserCreate(BaseModel):
    username: str = Field(..., pattern=USERNAME_PATTERN, description="POSIX username (lowercase)")
    password: str = Field(..., min_length=6, max_length=256)
    display_name: str | None = Field(None, max_length=128)


class SambaUserUpdate(BaseModel):
    display_name: str | None = Field(None, max_length=128)
    enabled: bool | None = None


class SambaUserPasswordReset(BaseModel):
    password: str = Field(..., min_length=6, max_length=256)


class SambaUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    display_name: str | None
    enabled: bool
    created_at: datetime

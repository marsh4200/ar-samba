"""Schemas for the legacy-config discovery/import feature."""
from datetime import datetime

from pydantic import BaseModel, Field


class DiscoveredShareOut(BaseModel):
    name: str
    path: str
    comment: str | None = None
    browseable: bool = True
    read_only: bool = True
    guest_ok: bool = False
    valid_users: list[str] = Field(default_factory=list)


class DiscoveredUserOut(BaseModel):
    username: str
    display_name: str | None = None
    enabled: bool = True


class DiscoveryScanOut(BaseModel):
    scanned_at: datetime
    shares: list[DiscoveredShareOut] = Field(default_factory=list)
    users: list[DiscoveredUserOut] = Field(default_factory=list)
    # Set only when that half of the scan couldn't run at all (e.g. testparm
    # or pdbedit missing/erroring) — an empty list with no error just means
    # nothing unmanaged was found.
    shares_error: str | None = None
    users_error: str | None = None


class DiscoveryImportIn(BaseModel):
    usernames: list[str] = Field(default_factory=list)
    share_names: list[str] = Field(default_factory=list)


class ImportItemResult(BaseModel):
    name: str
    status: str  # "imported" | "skipped" | "error"
    detail: str | None = None


class DiscoveryImportOut(BaseModel):
    users: list[ImportItemResult] = Field(default_factory=list)
    shares: list[ImportItemResult] = Field(default_factory=list)

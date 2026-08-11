"""System status and dashboard schemas."""
from datetime import datetime

from pydantic import BaseModel


class ServiceStatus(BaseModel):
    name: str
    active: bool
    state: str         # e.g. "active (running)"
    pid: int | None = None


class StorageInfo(BaseModel):
    path: str
    total_bytes: int
    used_bytes: int
    free_bytes: int
    percent: float


class DashboardOut(BaseModel):
    user_count: int
    share_count: int
    services: list[ServiceStatus]
    storage: list[StorageInfo]
    recent_activity: list["ActivityOut"]
    version: str


class ActivityOut(BaseModel):
    id: int
    ts: datetime
    actor: str
    category: str
    action: str
    target: str | None
    status: str
    details: str | None


DashboardOut.model_rebuild()


class HostMetrics(BaseModel):
    """Live host telemetry for the dashboard gauges."""
    hostname: str
    kernel: str
    cpu_percent: float
    cpu_cores: int
    cpu_threads: int
    load_1: float
    load_5: float
    load_15: float
    memory_total: int
    memory_used: int
    memory_percent: float
    swap_total: int
    swap_used: int
    swap_percent: float
    uptime_seconds: int


class VersionInfo(BaseModel):
    current: str
    latest: str | None = None
    update_available: bool = False
    release_notes: str | None = None
    release_url: str | None = None


class UpdateJobStatus(BaseModel):
    id: str
    state: str   # idle, running, success, error
    step: str
    progress: int
    logs: list[str]
    started_at: datetime | None = None
    finished_at: datetime | None = None
    error: str | None = None

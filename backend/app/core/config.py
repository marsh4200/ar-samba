"""Application configuration loaded from environment variables."""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration."""

    model_config = SettingsConfigDict(
        env_prefix="SAMBACONTROL_",
        env_file=".env",
        extra="ignore",
    )

    # Web
    web_port: int = 9912
    api_port: int = 9913
    bind_host: str = "0.0.0.0"

    # Security
    secret_key: str = "INSECURE-CHANGE-ME"
    jwt_alg: str = "HS256"
    access_token_minutes: int = 60          # JWT access token lifetime
    refresh_token_days: int = 14
    idle_timeout_minutes: int = 15          # Frontend auto-logout after inactivity (0 = disabled)
    smb_deadtime_minutes: int = 0           # Server-side Samba session timeout (0 = disabled)

    # Database
    database_url: str = "sqlite:////opt/sambacontrol/data/sambacontrol.db"

    # Samba
    shares_root: Path = Path("/srv/samba/shares")
    smb_conf: Path = Path("/etc/samba/smb.conf")
    smb_include: Path = Path("/etc/samba/sambacontrol.conf")

    # Updater
    github_repo: str = "marsh4200/ar-samba"
    install_dir: Path = Path("/opt/sambacontrol")
    backup_dir: Path = Path("/opt/sambacontrol/backups")

    # Logging
    log_level: str = "INFO"
    log_dir: Path = Path("/var/log/sambacontrol")

    # Dev override — when true, samba/system commands are simulated instead of executed.
    # The installer sets this to false on real servers.
    dev_mode: bool = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()

"""Centralised logging configuration."""
import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

from app.core.config import get_settings


def setup_logging() -> None:
    """Configure root + app loggers. Idempotent."""
    settings = get_settings()
    level = getattr(logging, settings.log_level.upper(), logging.INFO)

    root = logging.getLogger()
    if getattr(root, "_sambacontrol_configured", False):
        return
    root.setLevel(level)
    root.handlers.clear()

    fmt = logging.Formatter(
        "%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S%z",
    )

    # Stdout
    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(fmt)
    root.addHandler(sh)

    # File (best-effort)
    try:
        settings.log_dir.mkdir(parents=True, exist_ok=True)
        fh = RotatingFileHandler(
            settings.log_dir / "sambacontrol.log",
            maxBytes=5 * 1024 * 1024,
            backupCount=5,
        )
        fh.setFormatter(fmt)
        root.addHandler(fh)
    except (PermissionError, OSError):
        # No log dir access (e.g. running unprivileged in dev) — stdout only.
        pass

    root._sambacontrol_configured = True  # type: ignore[attr-defined]

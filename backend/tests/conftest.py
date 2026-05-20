"""Shared pytest fixtures."""
import os
import sys
import tempfile
from pathlib import Path

import pytest


@pytest.fixture(scope="session", autouse=True)
def _env():
    """Force dev mode and isolated paths before importing the app."""
    tmp = Path(tempfile.mkdtemp(prefix="sambacontrol-test-"))
    os.environ.update({
        "SAMBACONTROL_DEV_MODE": "true",
        "SAMBACONTROL_SECRET_KEY": "test-secret-do-not-use",
        "SAMBACONTROL_DATABASE_URL": f"sqlite:///{tmp / 'test.db'}",
        "SAMBACONTROL_LOG_DIR": str(tmp / "logs"),
        "SAMBACONTROL_BACKUP_DIR": str(tmp / "backups"),
        "SAMBACONTROL_INSTALL_DIR": str(tmp / "install"),
        "SAMBACONTROL_SHARES_ROOT": str(tmp / "shares"),
        "SAMBACONTROL_SMB_CONF": str(tmp / "smb.conf"),
        "SAMBACONTROL_SMB_INCLUDE": str(tmp / "sambacontrol.conf"),
    })
    for d in (tmp / "logs", tmp / "backups", tmp / "install", tmp / "shares"):
        d.mkdir(parents=True, exist_ok=True)
    (tmp / "smb.conf").write_text("[global]\nworkgroup = WORKGROUP\n")

    # Make app importable
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

    # Force a fresh settings load
    from app.core.config import get_settings
    get_settings.cache_clear()
    yield


@pytest.fixture()
def client():
    from fastapi.testclient import TestClient
    from app.main import app
    from app.core.database import init_db
    init_db()
    with TestClient(app) as c:
        yield c

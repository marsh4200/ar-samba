"""Tests for the legacy-config discovery/import feature.

NB: every `app.*` import here is deferred into a fixture or test body rather
than sitting at module level. `app.core.database` binds its SQLAlchemy engine
to `settings.database_url` as soon as it's first imported, and the `_env`
fixture in conftest.py only overrides that setting during test *setup* — a
module-level `from app.services import discovery import` would run during
test *collection*, before `_env` has run, and would silently bind every test
in the session to the real default database path instead of the throwaway
one.
"""
import pytest


@pytest.fixture
def discovery():
    from app.services import discovery as m
    return m


# --------------------------------------------------------------------------- parsers

def test_parse_testparm_dump_extracts_sections_and_params(discovery):
    text = """
    Load smb config files from /etc/samba/smb.conf
    Loaded services file OK.
    Weak crypto is allowed
    # Global parameters
    [global]
        workgroup = WORKGROUP
        server string = fileserver

    [printers]
        comment = All Printers
        path = /var/spool/samba

    [oldshare]
        comment = Hand-configured share
        path = /srv/data/oldshare
        read only = No
        guest ok = Yes
        valid users = bob, alice
    """
    sections = discovery._parse_testparm_dump(text)
    assert set(sections) == {"global", "printers", "oldshare"}
    assert sections["oldshare"]["path"] == "/srv/data/oldshare"
    assert sections["oldshare"]["read only"] == "No"
    assert sections["oldshare"]["valid users"] == "bob, alice"


def test_parse_pdbedit_verbose_splits_blocks_on_blank_lines(discovery):
    text = """Unix username:        bob
NT username:
Account Flags:        [U          ]
Full Name:            Bob Smith

Unix username:        alice
Account Flags:        [UD         ]
Full Name:
"""
    blocks = discovery._parse_pdbedit_verbose(text)
    assert len(blocks) == 2
    assert blocks[0]["Unix username"] == "bob"
    assert blocks[0]["Full Name"] == "Bob Smith"
    assert blocks[1]["Unix username"] == "alice"
    assert blocks[1]["Account Flags"] == "[UD         ]"


def test_scan_shares_skips_reserved_sections(discovery, monkeypatch):
    from app.services.runner import CommandResult

    dump = (
        "[global]\n   workgroup = WORKGROUP\n\n"
        "[homes]\n   browseable = No\n\n"
        "[legacy]\n   path = /srv/legacy\n   read only = No\n"
    )
    monkeypatch.setattr(discovery, "run", lambda *a, **k: CommandResult(0, dump, ""))
    shares, error = discovery.scan_shares()
    assert error is None
    assert [s.name for s in shares] == ["legacy"]
    assert shares[0].path == "/srv/legacy"
    assert shares[0].read_only is False


def test_scan_users_marks_disabled_accounts(discovery, monkeypatch):
    from app.services.runner import CommandResult

    dump = (
        "Unix username:        bob\nAccount Flags:        [U          ]\nFull Name:  Bob\n\n"
        "Unix username:        alice\nAccount Flags:        [UD         ]\nFull Name:\n"
    )
    monkeypatch.setattr(discovery, "run", lambda *a, **k: CommandResult(0, dump, ""))
    users, error = discovery.scan_users()
    assert error is None
    by_name = {u.username: u for u in users}
    assert by_name["bob"].enabled is True
    assert by_name["alice"].enabled is False


# --------------------------------------------------------------------------- API

def _admin_headers(client):
    creds = {"username": "admin", "password": "super-secret-123"}
    r = client.post("/api/auth/setup", json=creds)
    if r.status_code == 409:
        r = client.post("/api/auth/login-json", json=creds)
    assert r.status_code in (200, 201), r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_scan_endpoint_reports_nothing_in_dev_mode(client):
    """DEV_MODE short-circuits every subprocess call — testparm/pdbedit never
    actually run, so a fresh install correctly reports nothing to import."""
    headers = _admin_headers(client)
    r = client.get("/api/discovery/scan", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["shares"] == []
    assert body["users"] == []
    assert body["shares_error"] is None
    assert body["users_error"] is None


def test_import_adopts_discovered_users_and_shares(client, discovery, monkeypatch):
    headers = _admin_headers(client)

    fake_user = discovery.DiscoveredUser(username="bob", display_name="Bob Smith", enabled=True)
    fake_share = discovery.DiscoveredShare(
        name="legacy1", path="/srv/legacy1", comment="Old share",
        browseable=True, read_only=False, guest_ok=False, valid_users=["bob"],
    )
    monkeypatch.setattr(discovery, "scan_users", lambda: ([fake_user], None))
    monkeypatch.setattr(discovery, "scan_shares", lambda: ([fake_share], None))

    # 1. Scan finds both.
    r = client.get("/api/discovery/scan", headers=headers)
    body = r.json()
    assert [u["username"] for u in body["users"]] == ["bob"]
    assert [s["name"] for s in body["shares"]] == ["legacy1"]

    # 2. Import both.
    r = client.post(
        "/api/discovery/import",
        json={"usernames": ["bob"], "share_names": ["legacy1"]},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    result = r.json()
    assert result["users"] == [{
        "name": "bob", "status": "imported",
        "detail": "Existing Samba account adopted; its password was left as-is.",
    }]
    assert result["shares"][0]["name"] == "legacy1"
    assert result["shares"][0]["status"] == "imported"

    # 3. It now shows up on the normal Users/Shares pages.
    users = client.get("/api/users", headers=headers).json()
    assert any(u["username"] == "bob" for u in users)
    shares = client.get("/api/shares", headers=headers).json()
    share = next(s for s in shares if s["name"] == "legacy1")
    assert share["path"] == "/srv/legacy1"

    # 4. The valid-users grant from the legacy config was carried over.
    access = client.get(f"/api/shares/{share['id']}/access", headers=headers).json()
    assert any(a["can_write"] for a in access)  # read_only was False

    # 5. Scanning again reports nothing new — both are now tracked.
    r = client.get("/api/discovery/scan", headers=headers)
    body = r.json()
    assert body["users"] == []
    assert body["shares"] == []

    # 6. Re-importing the same names is a no-op, not a duplicate/error.
    r = client.post(
        "/api/discovery/import",
        json={"usernames": ["bob"], "share_names": ["legacy1"]},
        headers=headers,
    )
    result = r.json()
    assert result["users"][0]["status"] == "skipped"
    assert result["shares"][0]["status"] == "skipped"


def test_import_skips_names_no_longer_present(client, discovery, monkeypatch):
    headers = _admin_headers(client)
    monkeypatch.setattr(discovery, "scan_users", lambda: ([], None))
    monkeypatch.setattr(discovery, "scan_shares", lambda: ([], None))

    r = client.post(
        "/api/discovery/import",
        json={"usernames": ["ghost"], "share_names": ["vanished"]},
        headers=headers,
    )
    assert r.status_code == 200
    result = r.json()
    assert result["users"][0]["status"] == "skipped"
    assert result["shares"][0]["status"] == "skipped"

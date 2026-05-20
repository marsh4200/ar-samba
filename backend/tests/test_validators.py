"""Tests for input validators — path traversal, reserved names, etc."""
import pytest

from app.utils.validators import (
    ValidationError,
    resolve_share_path,
    validate_share_name,
    validate_username,
)


# ─── usernames ────────────────────────────────────────────────────────────

@pytest.mark.parametrize("name", ["raymond", "alice", "user_1", "a-b-c", "_underscore"])
def test_valid_usernames(name):
    assert validate_username(name) == name


@pytest.mark.parametrize("name", [
    "Raymond",          # uppercase
    "1raymond",         # starts with digit
    "ray mond",         # space
    "a" * 33,           # too long
    "",                 # empty
    "raymond;",         # injection char
    "../etc/passwd",
])
def test_invalid_usernames(name):
    with pytest.raises(ValidationError):
        validate_username(name)


@pytest.mark.parametrize("name", ["root", "daemon", "bin", "sys", "nobody", "sambacontrol"])
def test_reserved_usernames(name):
    with pytest.raises(ValidationError):
        validate_username(name)


# ─── share names ──────────────────────────────────────────────────────────

@pytest.mark.parametrize("name", ["cncserver", "team-data", "ARCHIVE", "files.2024", "_priv"])
def test_valid_share_names(name):
    assert validate_share_name(name) == name


@pytest.mark.parametrize("name", [
    "global",       # reserved
    "homes",
    "printers",
    "print$",
    "",
    "a b",
    "../etc",
    "x" * 65,
])
def test_invalid_share_names(name):
    with pytest.raises(ValidationError):
        validate_share_name(name)


# ─── path traversal jail ─────────────────────────────────────────────────

def test_resolves_relative_under_root():
    p = resolve_share_path("myshare")
    assert "shares" in str(p)
    assert str(p).endswith("/myshare")


def test_resolves_absolute_inside_root(monkeypatch):
    from app.core.config import get_settings
    root = get_settings().shares_root
    p = resolve_share_path(str(root / "ok"))
    assert p == (root / "ok").resolve()


def test_rejects_path_traversal():
    with pytest.raises(ValidationError):
        resolve_share_path("../outside")


def test_rejects_absolute_outside_root():
    with pytest.raises(ValidationError):
        resolve_share_path("/etc/passwd")


def test_rejects_double_traversal():
    with pytest.raises(ValidationError):
        resolve_share_path("foo/../../bar")

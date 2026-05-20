"""Input validation helpers — path-traversal guards, name sanitisation."""
import re
from pathlib import Path

from app.core.config import get_settings

_USERNAME_RE = re.compile(r"^[a-z_][a-z0-9_-]{0,31}$")
_SHARE_RE = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$")


class ValidationError(ValueError):
    """Raised when user input fails validation."""


def validate_username(name: str) -> str:
    if not _USERNAME_RE.match(name):
        raise ValidationError(
            "Invalid username. Must be lowercase, start with a letter/underscore, "
            "and contain only letters, digits, underscore or hyphen (max 32 chars)."
        )
    # Block known sensitive system accounts
    if name in {"root", "daemon", "bin", "sys", "nobody", "sambacontrol"}:
        raise ValidationError(f"Username '{name}' is reserved.")
    return name


def validate_share_name(name: str) -> str:
    if not _SHARE_RE.match(name):
        raise ValidationError(
            "Invalid share name. Letters, digits, '.', '_', '-' only (max 64 chars)."
        )
    # 'global' is a smb.conf reserved section
    if name.lower() in {"global", "homes", "printers", "print$"}:
        raise ValidationError(f"Share name '{name}' is reserved by Samba.")
    return name


def resolve_share_path(user_path: str) -> Path:
    """Resolve a share path and ensure it lies under SAMBACONTROL_SHARES_ROOT.

    Prevents path traversal: any '..' or symlink that would escape the root is rejected.
    """
    settings = get_settings()
    root = settings.shares_root.resolve()

    raw = Path(user_path)
    target = raw if raw.is_absolute() else (root / raw)

    # Resolve WITHOUT requiring existence — parents may not exist yet (we'll create them).
    try:
        resolved = target.resolve(strict=False)
    except (OSError, RuntimeError) as e:
        raise ValidationError(f"Could not resolve path: {e}") from e

    # Ensure resolved path is the root or a descendant.
    try:
        resolved.relative_to(root)
    except ValueError:
        raise ValidationError(
            f"Path must be inside {root}. Got: {resolved}"
        ) from None

    # No surprises: disallow these path components.
    for part in resolved.parts:
        if part in {"..", "~"}:
            raise ValidationError("Path contains illegal component.")

    return resolved

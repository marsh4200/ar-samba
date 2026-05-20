"""Safe subprocess execution.

All shell-outs in SambaControl go through `run()`. Rules:

* Never use shell=True
* Always pass argv as a list of strings
* Capture and log stdout/stderr
* Enforce a timeout
* Honour DEV_MODE — if true, commands are logged but not executed
"""
from __future__ import annotations

import logging
import shlex
import subprocess
from dataclasses import dataclass
from typing import Iterable, Sequence

from app.core.config import get_settings

logger = logging.getLogger(__name__)


@dataclass
class CommandResult:
    returncode: int
    stdout: str
    stderr: str

    @property
    def ok(self) -> bool:
        return self.returncode == 0


class CommandError(RuntimeError):
    def __init__(self, cmd: Sequence[str], result: CommandResult):
        self.cmd = list(cmd)
        self.result = result
        super().__init__(
            f"Command failed (rc={result.returncode}): {shlex.join(self.cmd)}\n"
            f"stderr: {result.stderr.strip()[:500]}"
        )


def run(
    cmd: Sequence[str],
    *,
    check: bool = True,
    input_text: str | None = None,
    timeout: int = 60,
    sudo: bool = False,
) -> CommandResult:
    """Execute a command.

    Args:
        cmd: argv list. NEVER includes user input as a separate shell string.
        check: raise CommandError on non-zero exit.
        input_text: optional stdin text.
        timeout: hard timeout, seconds.
        sudo: prepend `sudo -n` (non-interactive sudo).
    """
    settings = get_settings()
    argv: list[str] = list(cmd)
    if sudo:
        argv = ["sudo", "-n", *argv]

    pretty = shlex.join(argv)
    logger.debug("exec: %s", pretty)

    if settings.dev_mode:
        logger.info("[DEV_MODE] would run: %s", pretty)
        return CommandResult(returncode=0, stdout="", stderr="")

    try:
        proc = subprocess.run(
            argv,
            input=input_text,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except FileNotFoundError as e:
        raise CommandError(argv, CommandResult(127, "", str(e))) from e
    except subprocess.TimeoutExpired as e:
        raise CommandError(argv, CommandResult(124, "", f"timeout after {timeout}s: {e}")) from e

    result = CommandResult(
        returncode=proc.returncode,
        stdout=proc.stdout or "",
        stderr=proc.stderr or "",
    )
    if check and not result.ok:
        raise CommandError(argv, result)
    return result


def stream_run(cmd: Sequence[str], *, sudo: bool = False, timeout: int = 600) -> Iterable[str]:
    """Generator yielding stdout lines in real time. Used by the updater UI.

    Raises CommandError on non-zero exit so callers can detect failure and
    trigger rollback. Without this, a failing update.sh would silently be
    treated as a success.
    """
    settings = get_settings()
    argv = list(cmd)
    if sudo:
        argv = ["sudo", "-n", *argv]

    if settings.dev_mode:
        yield f"[DEV_MODE] would run: {shlex.join(argv)}"
        return

    proc = subprocess.Popen(
        argv,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    try:
        assert proc.stdout is not None
        for line in proc.stdout:
            yield line.rstrip("\n")
        proc.wait(timeout=timeout)
    finally:
        if proc.poll() is None:
            proc.kill()
    if proc.returncode != 0:
        yield f"[error] exit code {proc.returncode}"
        raise CommandError(argv, CommandResult(
            returncode=proc.returncode,
            stdout="",
            stderr=f"command failed: {shlex.join(argv)}",
        ))

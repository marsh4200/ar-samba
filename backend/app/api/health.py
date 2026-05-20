"""Lightweight health probe — no auth required."""
from fastapi import APIRouter

from app import __version__

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
def health() -> dict:
    return {"status": "ok", "version": __version__}

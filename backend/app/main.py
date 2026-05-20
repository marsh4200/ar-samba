"""SambaControl FastAPI application."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.requests import Request

from app import __version__
from app.api import auth, health, logs, shares, system, updates, users
from app.core.config import get_settings
from app.core.database import init_db
from app.core.logging_setup import setup_logging
from app.services.runner import CommandError

setup_logging()
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting SambaControl backend v%s", __version__)
    init_db()
    yield
    logger.info("Stopping SambaControl backend")


app = FastAPI(
    title="SambaControl API",
    version=__version__,
    description="Self-hosted Samba + ACL management for Ubuntu Server.",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# CORS — when frontend served by Nginx on the same port this is moot, but useful in dev.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(CommandError)
async def command_error_handler(_: Request, exc: CommandError):
    return JSONResponse(
        status_code=500,
        content={
            "detail": "System command failed",
            "command": exc.cmd[0] if exc.cmd else None,
            "stderr": exc.result.stderr.strip()[:400],
        },
    )


# Mount all routers under /api
API = "/api"
app.include_router(health.router, prefix=API)
app.include_router(auth.router, prefix=API)
app.include_router(users.router, prefix=API)
app.include_router(shares.router, prefix=API)
app.include_router(system.router, prefix=API)
app.include_router(logs.router, prefix=API)
app.include_router(updates.router, prefix=API)


@app.get("/")
def root():
    return {
        "name": "SambaControl",
        "version": __version__,
        "docs": "/api/docs",
    }

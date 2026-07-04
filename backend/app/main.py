"""FastAPI application entry point.

The app is designed to *always start* even when the optional ML dependencies
(faster-whisper, torch, Piper) or their model files are not yet installed.
Speech features report their availability via ``/api/system/status`` and return
clear, actionable errors when used before setup is complete.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import LEVEL_NAMES, LEVELS, settings
from .content_loader import get_store

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("portugues")

app = FastAPI(
    title="Aprender Português — local Brazilian Portuguese tutor",
    version="1.0.0",
    description="Offline, self-hosted Brazilian Portuguese learning API.",
)

# Vite dev server runs on 5173; allow local origins during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

system_router = APIRouter(prefix="/api/system", tags=["system"])


@system_router.get("/status")
def system_status():
    """Reports which features are ready. The UI uses this to enable/disable
    speech features and show setup hints."""
    from .services import asr_service, tts_service

    store = get_store()
    return {
        "content": store.stats(),
        "levels": [{"level": l, "name": LEVEL_NAMES[l]} for l in LEVELS],
        "tts": tts_service.status(),
        "asr": asr_service.status(),
    }


@system_router.get("/health")
def health():
    return {"ok": True}


# --------------------------------------------------------------------------- #
# Routers. Speech routers import lazily so missing ML deps never block startup.
# --------------------------------------------------------------------------- #
from .routers import content as content_router  # noqa: E402

app.include_router(system_router)
app.include_router(content_router.router)

try:
    from .routers import progress as progress_router

    app.include_router(progress_router.router)
except Exception as exc:  # pragma: no cover
    logger.warning("Progress router unavailable: %s", exc)

try:
    from .routers import tts as tts_router

    app.include_router(tts_router.router)
except Exception as exc:  # pragma: no cover
    logger.warning("TTS router unavailable: %s", exc)

try:
    from .routers import pronunciation as pron_router

    app.include_router(pron_router.router)
except Exception as exc:  # pragma: no cover
    logger.warning("Pronunciation router unavailable: %s", exc)


@app.get("/")
def root():
    return {
        "app": "Aprender Português",
        "docs": "/docs",
        "status": "/api/system/status",
    }

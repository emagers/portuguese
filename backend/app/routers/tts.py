"""Text-to-speech endpoint (Piper). Streams WAV audio for a given phrase."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Response

from ..services import tts_service

router = APIRouter(prefix="/api/tts", tags=["tts"])


@router.get("/status")
def tts_status():
    return tts_service.status()


@router.get("")
def synthesize(text: str = Query(..., min_length=1, max_length=1000)):
    try:
        wav = tts_service.synthesize(text)
    except RuntimeError as exc:
        # TTS not configured -> 503 so the client can fall back to browser TTS.
        raise HTTPException(status_code=503, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return Response(
        content=wav,
        media_type="audio/wav",
        headers={"Cache-Control": "public, max-age=86400"},
    )

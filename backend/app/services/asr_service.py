"""Offline speech recognition using faster-whisper.

The Whisper model is loaded lazily on first use so the server starts instantly.
On a CUDA GPU it uses float16; otherwise it falls back to
int8 on CPU, which is still fast for the short phrases used in pronunciation
practice.
"""
from __future__ import annotations

import importlib.util
import logging
import threading
from typing import Optional

from ..config import settings

logger = logging.getLogger("portugues.asr")

_model = None
_model_lock = threading.Lock()
_load_error: Optional[str] = None
_resolved_device: Optional[str] = None


def _faster_whisper_available() -> bool:
    return importlib.util.find_spec("faster_whisper") is not None


def _resolve_device() -> tuple[str, str]:
    """Return (device, compute_type)."""
    device = settings.whisper_device
    if device == "auto":
        try:
            import torch  # type: ignore

            device = "cuda" if torch.cuda.is_available() else "cpu"
        except Exception:
            device = "cpu"
    if settings.whisper_compute_type:
        compute = settings.whisper_compute_type
    else:
        compute = "float16" if device == "cuda" else "int8"
    return device, compute


def status() -> dict:
    available = _faster_whisper_available()
    device, compute = _resolve_device() if available else ("none", "none")
    return {
        "available": available,
        "engine": "faster-whisper" if available else "none",
        "model": settings.whisper_model,
        "device": device,
        "compute_type": compute,
        "loaded": _model is not None,
        "load_error": _load_error,
        "reason": None
        if available
        else "faster-whisper not installed. Run scripts/setup.ps1.",
    }


def get_model():
    """Lazily construct and cache the Whisper model (thread-safe)."""
    global _model, _load_error, _resolved_device
    if _model is not None:
        return _model
    with _model_lock:
        if _model is not None:
            return _model
        if not _faster_whisper_available():
            raise RuntimeError("faster-whisper is not installed")
        from faster_whisper import WhisperModel  # type: ignore

        device, compute = _resolve_device()
        _resolved_device = device
        logger.info(
            "Loading Whisper '%s' on %s (%s)...",
            settings.whisper_model,
            device,
            compute,
        )
        try:
            _model = WhisperModel(
                settings.whisper_model,
                device=device,
                compute_type=compute,
                download_root=str(settings.models_cache_dir / "whisper"),
            )
        except Exception as exc:  # e.g. missing CUDA libs -> retry on CPU
            logger.warning("Whisper load failed on %s (%s); trying CPU", device, exc)
            _load_error = str(exc)
            _model = WhisperModel(
                settings.whisper_model,
                device="cpu",
                compute_type="int8",
                download_root=str(settings.models_cache_dir / "whisper"),
            )
            _resolved_device = "cpu"
        return _model


def transcribe(audio_path: str, language: str = "pt") -> dict:
    """Transcribe ``audio_path`` and return text plus per-word info."""
    model = get_model()
    segments, info = model.transcribe(
        audio_path,
        language=language,
        beam_size=5,
        word_timestamps=True,
        vad_filter=True,
    )
    words = []
    text_parts = []
    for seg in segments:
        text_parts.append(seg.text)
        for w in seg.words or []:
            words.append(
                {
                    "word": w.word.strip(),
                    "start": round(w.start, 3),
                    "end": round(w.end, 3),
                    "probability": round(float(w.probability), 4),
                }
            )
    return {
        "text": "".join(text_parts).strip(),
        "language": info.language,
        "language_probability": round(float(info.language_probability), 4),
        "duration": round(float(info.duration), 3),
        "words": words,
    }

"""Offline text-to-speech using Piper.

Piper is a fast, fully-local neural TTS. We invoke the standalone Piper binary
(no fragile Python packaging) and cache synthesised audio by content hash so
repeated playback of the same phrase is instant.

If Piper is not installed the service reports ``available: False`` and the
frontend falls back to the browser's built-in speech synthesis.
"""
from __future__ import annotations

import hashlib
import subprocess
from pathlib import Path
from typing import Optional

from ..config import settings


def _find_piper_exe() -> Optional[Path]:
    if settings.piper_exe and Path(settings.piper_exe).exists():
        return Path(settings.piper_exe)
    # Common locations inside the models cache.
    candidates = [
        settings.models_cache_dir / "piper" / "piper.exe",
        settings.models_cache_dir / "piper" / "piper",
    ]
    for c in candidates:
        if c.exists():
            return c
    return None


def _find_voice() -> Optional[Path]:
    if settings.piper_voice and Path(settings.piper_voice).exists():
        return Path(settings.piper_voice)
    voices_dir = settings.models_cache_dir / "piper" / "voices"
    if voices_dir.exists():
        # Prefer a Brazilian Portuguese voice if present.
        onnx = sorted(voices_dir.glob("*.onnx"))
        pt = [p for p in onnx if "pt_BR" in p.name or "pt-BR" in p.name]
        chosen = (pt or onnx)
        if chosen:
            return chosen[0]
    return None


def status() -> dict:
    exe = _find_piper_exe()
    voice = _find_voice()
    available = bool(exe and voice)
    reason = None
    if not exe:
        reason = "Piper binary not found. Run scripts/download_models.py."
    elif not voice:
        reason = "No Piper voice (.onnx) found in models_cache/piper/voices."
    return {
        "available": available,
        "engine": "piper" if available else "none",
        "voice": voice.name if voice else None,
        "reason": reason,
        "fallback": "browser",
    }


def _cache_path(text: str, voice: Path) -> Path:
    key = hashlib.sha1(f"{voice.name}::{text}".encode("utf-8")).hexdigest()
    return settings.audio_cache_dir / f"{key}.wav"


def synthesize(text: str) -> bytes:
    """Return WAV bytes for ``text``. Raises RuntimeError if TTS unavailable."""
    exe = _find_piper_exe()
    voice = _find_voice()
    if not (exe and voice):
        raise RuntimeError(status()["reason"] or "TTS unavailable")

    text = (text or "").strip()
    if not text:
        raise ValueError("Empty text")

    out = _cache_path(text, voice)
    if out.exists() and out.stat().st_size > 0:
        return out.read_bytes()

    cmd = [
        str(exe),
        "--model",
        str(voice),
        "--output_file",
        str(out),
    ]
    proc = subprocess.run(
        cmd,
        input=text.encode("utf-8"),
        capture_output=True,
        timeout=120,
    )
    if proc.returncode != 0 or not out.exists():
        raise RuntimeError(
            f"Piper failed: {proc.stderr.decode('utf-8', 'ignore')[:500]}"
        )
    return out.read_bytes()

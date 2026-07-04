"""Offline text-to-speech using Piper, with multiple Brazilian voices.

Piper is a fast, fully-local neural TTS. We invoke the standalone Piper binary
(no fragile Python packaging) and cache synthesised audio by content hash so
repeated playback of the same phrase is instant. Several pt-BR voices can be
installed so dialogue characters sound different.

If Piper is not installed the service reports ``available: False`` and the
frontend falls back to the browser's built-in speech synthesis.
"""
from __future__ import annotations

import hashlib
import subprocess
from pathlib import Path
from typing import Dict, List, Optional

from ..config import settings

# Preferred default voice (falls back to whatever is installed).
_PREFERRED_DEFAULT = "pt_BR-faber-medium"


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


def voice_registry() -> Dict[str, Path]:
    """Map of available voice name (file stem) -> .onnx path."""
    registry: Dict[str, Path] = {}
    if settings.piper_voice and Path(settings.piper_voice).exists():
        p = Path(settings.piper_voice)
        registry[p.stem] = p
    voices_dir = settings.models_cache_dir / "piper" / "voices"
    if voices_dir.exists():
        for onnx in sorted(voices_dir.glob("*.onnx")):
            registry.setdefault(onnx.stem, onnx)
    return registry


def list_voices() -> List[str]:
    return sorted(voice_registry().keys())


def default_voice() -> Optional[str]:
    reg = voice_registry()
    if not reg:
        return None
    if _PREFERRED_DEFAULT in reg:
        return _PREFERRED_DEFAULT
    for name in reg:
        if "faber" in name:
            return name
    return sorted(reg.keys())[0]


def _resolve_voice(name: Optional[str]) -> Optional[Path]:
    reg = voice_registry()
    if not reg:
        return None
    if name and name in reg:
        return reg[name]
    dv = default_voice()
    return reg.get(dv) if dv else None


def status() -> dict:
    exe = _find_piper_exe()
    voices = list_voices()
    available = bool(exe and voices)
    reason = None
    if not exe:
        reason = "Piper binary not found. Run scripts/download_models.py."
    elif not voices:
        reason = "No Piper voice (.onnx) found in models_cache/piper/voices."
    return {
        "available": available,
        "engine": "piper" if available else "none",
        "voice": default_voice(),
        "voices": voices,
        "reason": reason,
        "fallback": "browser",
    }


def _cache_path(text: str, voice: Path) -> Path:
    key = hashlib.sha1(f"{voice.name}::{text}".encode("utf-8")).hexdigest()
    return settings.audio_cache_dir / f"{key}.wav"


def synthesize(text: str, voice: Optional[str] = None) -> bytes:
    """Return WAV bytes for ``text`` in the given voice (or the default).

    Raises RuntimeError if TTS is unavailable, ValueError for empty text.
    """
    exe = _find_piper_exe()
    voice_path = _resolve_voice(voice)
    if not (exe and voice_path):
        raise RuntimeError(status()["reason"] or "TTS unavailable")

    text = (text or "").strip()
    if not text:
        raise ValueError("Empty text")

    out = _cache_path(text, voice_path)
    if out.exists() and out.stat().st_size > 0:
        return out.read_bytes()

    cmd = [
        str(exe),
        "--model",
        str(voice_path),
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

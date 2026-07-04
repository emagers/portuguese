#!/usr/bin/env python
"""Download the local models needed for audio and pronunciation features.

Everything downloaded here is free and open-source, and is stored under
``backend/models_cache`` so the app runs fully offline afterwards.

Downloads:
  * Piper (neural TTS) Windows binary + a Brazilian Portuguese voice.
  * The faster-whisper speech-recognition model (for pronunciation scoring).
  * Optionally, the wav2vec2 phoneme model (if torch + transformers are present).

Re-running is safe: existing files are skipped.
"""
from __future__ import annotations

import os
import sys
import urllib.request
import zipfile
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent / "backend"
CACHE = BACKEND / "models_cache"
PIPER_DIR = CACHE / "piper"
VOICES_DIR = PIPER_DIR / "voices"

PIPER_ZIP_URL = (
    "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/"
    "piper_windows_amd64.zip"
)
_VOICE_BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR"
# Multiple distinct Brazilian voices so dialogue characters can sound different.
VOICE_URLS = [
    f"{_VOICE_BASE}/faber/medium/pt_BR-faber-medium.onnx",
    f"{_VOICE_BASE}/cadu/medium/pt_BR-cadu-medium.onnx",
    f"{_VOICE_BASE}/jeff/medium/pt_BR-jeff-medium.onnx",
]
VOICE_FILES = [u for base in VOICE_URLS for u in (base, base + ".json")]


def _download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        print(f"  = already have {dest.name}")
        return
    print(f"  ↓ {url}")

    def hook(block, bsize, total):
        if total > 0:
            pct = min(100, block * bsize * 100 // total)
            sys.stdout.write(f"\r    {pct:3d}%")
            sys.stdout.flush()

    tmp = dest.with_suffix(dest.suffix + ".part")
    urllib.request.urlretrieve(url, tmp, hook)
    tmp.replace(dest)
    print(f"\r    done: {dest.name}")


def setup_piper() -> None:
    print("[1/3] Piper TTS")
    PIPER_DIR.mkdir(parents=True, exist_ok=True)
    exe = PIPER_DIR / "piper.exe"
    if not exe.exists():
        zip_path = CACHE / "piper_windows_amd64.zip"
        _download(PIPER_ZIP_URL, zip_path)
        print("  extracting…")
        with zipfile.ZipFile(zip_path) as z:
            z.extractall(CACHE)  # zip contains a top-level 'piper/' folder
        zip_path.unlink(missing_ok=True)
    if exe.exists():
        print(f"  ✓ piper.exe at {exe}")
    else:
        print("  ! piper.exe not found after extraction — check the archive layout")

    print(f"  downloading {len(VOICE_URLS)} voices…")
    for url in VOICE_FILES:
        _download(url, VOICES_DIR / url.rsplit("/", 1)[-1])


def setup_whisper() -> None:
    print("[2/3] Whisper speech recognition model")
    try:
        from faster_whisper import WhisperModel
    except Exception:
        print("  ! faster-whisper not installed — run scripts/setup.ps1 first. Skipping.")
        return
    model = os.getenv("WHISPER_MODEL", "small")
    print(f"  loading '{model}' (downloads on first run)…")
    try:
        WhisperModel(
            model,
            device="cpu",
            compute_type="int8",
            download_root=str(CACHE / "whisper"),
        )
        print(f"  ✓ whisper '{model}' ready")
    except Exception as exc:
        print(f"  ! could not fetch whisper model: {exc}")


def setup_phoneme_model() -> None:
    print("[3/3] Acoustic phoneme model (optional)")
    try:
        from transformers import AutoModelForCTC, AutoProcessor
    except Exception:
        print("  = torch/transformers not installed — skipping (word-level scoring still works).")
        return
    model_id = os.getenv("PHONEME_MODEL", "facebook/wav2vec2-lv-60-espeak-cv-ft")
    try:
        print(f"  fetching {model_id}…")
        AutoProcessor.from_pretrained(model_id, cache_dir=str(CACHE / "hf"))
        AutoModelForCTC.from_pretrained(model_id, cache_dir=str(CACHE / "hf"))
        print("  ✓ phoneme model ready")
    except Exception as exc:
        print(f"  ! could not fetch phoneme model: {exc}")


if __name__ == "__main__":
    CACHE.mkdir(parents=True, exist_ok=True)
    setup_piper()
    setup_whisper()
    setup_phoneme_model()
    print("\nAll set. Restart the backend to pick up new models.")

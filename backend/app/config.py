"""Application configuration.

All paths are resolved relative to the backend package so the app can be
launched from anywhere. Settings can be overridden with environment variables.
"""
from __future__ import annotations

import os
from pathlib import Path

# backend/app/config.py -> backend/
BACKEND_ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = BACKEND_ROOT / "content"
DATA_DIR = BACKEND_ROOT / "data"
MODELS_CACHE_DIR = BACKEND_ROOT / "models_cache"

# CEFR levels, ordered from beginner to advanced.
LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"]
LEVEL_NAMES = {
    "A1": "Beginner",
    "A2": "Elementary",
    "B1": "Intermediate",
    "B2": "Upper Intermediate",
    "C1": "Advanced",
    "C2": "Proficient",
}


class Settings:
    """Runtime settings, overridable via environment variables."""

    def __init__(self) -> None:
        self.content_dir = Path(os.getenv("PORTUGUES_CONTENT_DIR", str(CONTENT_DIR)))
        self.data_dir = Path(os.getenv("PORTUGUES_DATA_DIR", str(DATA_DIR)))
        self.models_cache_dir = Path(
            os.getenv("PORTUGUES_MODELS_DIR", str(MODELS_CACHE_DIR))
        )
        self.db_path = self.data_dir / "progress.db"

        # Text-to-speech (Piper).
        self.piper_exe = os.getenv("PIPER_EXE", "")  # path to piper(.exe)
        self.piper_voice = os.getenv("PIPER_VOICE", "")  # path to voice .onnx
        self.audio_cache_dir = self.data_dir / "audio_cache"

        # Speech recognition (faster-whisper).
        # tiny/base/small/medium/large-v3. "small" is a good speed/quality tradeoff.
        self.whisper_model = os.getenv("WHISPER_MODEL", "small")
        # auto|cuda|cpu -- resolved at load time in the ASR service.
        self.whisper_device = os.getenv("WHISPER_DEVICE", "auto")
        self.whisper_compute_type = os.getenv("WHISPER_COMPUTE_TYPE", "")

        # Phoneme recogniser (wav2vec2 espeak) for pronunciation scoring.
        self.phoneme_model = os.getenv(
            "PHONEME_MODEL", "facebook/wav2vec2-lv-60-espeak-cv-ft"
        )
        self.enable_phoneme_model = os.getenv("ENABLE_PHONEME_MODEL", "1") != "0"
        # CPU by default: torch+cuDNN on Windows can hard-crash for this model.
        # Set PHONEME_DEVICE=cuda to opt in once your CUDA stack is verified.
        self.phoneme_device = os.getenv("PHONEME_DEVICE", "cpu")

        self._ensure_dirs()

    def _ensure_dirs(self) -> None:
        for d in (self.data_dir, self.models_cache_dir, self.audio_cache_dir):
            d.mkdir(parents=True, exist_ok=True)


settings = Settings()
